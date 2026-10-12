// crisis-router Edge Function (Squad 1 Safety Track).
//
// Consumes crisis detection events from server-side sources (mood pulse,
// check-ins, AI-chat safety middleware) and applies the versioned routing
// ruleset (T1/T2/T3, sol-safety §1.4). Detection sources call this — detection
// logic is NEVER client-side.
//
// Routing summary:
//   T1 (imminent-risk language) -> trusted adult SMS immediately + in-app
//     988/Crisis Text Line/911 card to the teen + one re-alert at +15 min if
//     unacknowledged + DFCS-escalation evaluation logged for the compliance
//     owner (G7; the owner decides, this function does not file).
//   T2 (crisis-ideation language) -> trusted adult SMS within 5 min + teen
//     988 card + teen-controlled "tell a trusted adult" action.
//   T3 (pattern signals) -> NO external alert. Teen-facing nudge only. T3
//     never leaves the teen account.
//
// Hard invariants:
//   * Alerts route to the teen-designated trusted adult, never to a revoked
//     parent. No parent notification unless the parent IS the designated
//     trusted adult with a live grant.
//   * Alert content is presence-only ("may be in crisis"). No mood text,
//     check-in content, or chat excerpts.
//   * SMS failure falls back to email, then to the secondary trusted adult,
//     then to in-app escalation (crisis_alert.no_reachable_adult). The chain
//     NEVER falls back to a parent.
//   * D7 (coarse-only location): any lat/lng in the request is rejected with
//     400 precise_location_rejected. Location fields are city/postal_code.
//   * If the SMS provider is not configured, the function FAILS LOUDLY
//     (500 crisis_sms_provider_unconfigured) after writing the audit row —
//     it never silently skips an alert.
//
// Auth: service_role only. The caller presents x-crisis-router-secret
// matching the CRISIS_ROUTER_SECRET env var. If the env var is unset the
// function answers 503 (fail closed, not open).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Tier = "T1" | "T2" | "T3";
type Source = "mood_pulse" | "checkin" | "ai_chat";

interface DetectionEvent {
  child_id: string;
  tier: Tier;
  source: Source;
  detected_at?: string;
  teen_first_name?: string;
  location?: { city?: string; postal_code?: string; lat?: unknown; lng?: unknown };
}

interface TrustedAdult {
  id: string;
  child_id: string;
  display_name: string;
  priority: number;
  is_parent: boolean;
  parent_user_id: string | null;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const url = Deno.env.get("SAFETY_SMS_WEBHOOK_URL");
  if (!url) return { ok: false, error: "crisis_sms_provider_unconfigured" };
  const secret = Deno.env.get("SAFETY_SMS_WEBHOOK_SECRET");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ to, body }),
    });
  } catch {
    return { ok: false, error: "crisis_sms_provider_unreachable" };
  }
  if (!res.ok) return { ok: false, error: "crisis_sms_provider_rejected" };
  try {
    const parsed = await res.json();
    if (!parsed || parsed.ok !== true) return { ok: false, error: "crisis_sms_not_confirmed" };
  } catch {
    return { ok: false, error: "crisis_sms_bad_response" };
  }
  return { ok: true };
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const url = Deno.env.get("SAFETY_EMAIL_WEBHOOK_URL");
  if (!url) return false;
  const secret = Deno.env.get("SAFETY_EMAIL_WEBHOOK_SECRET");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ to, subject, body }),
    });
    if (!res.ok) return false;
    const parsed = await res.json();
    return !!parsed && parsed.ok === true;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: { code: "method_not_allowed" } });
  }

  const configuredSecret = Deno.env.get("CRISIS_ROUTER_SECRET");
  if (!configuredSecret) {
    return json(503, { ok: false, error: { code: "crisis_router_not_configured" } });
  }
  if (req.headers.get("x-crisis-router-secret") !== configuredSecret) {
    return json(401, { ok: false, error: { code: "unauthorized" } });
  }

  let event: DetectionEvent;
  try {
    event = (await req.json()) as DetectionEvent;
  } catch {
    return json(400, { ok: false, error: { code: "invalid_json" } });
  }

  if (!event.child_id || !["T1", "T2", "T3"].includes(event.tier)) {
    return json(400, { ok: false, error: { code: "invalid_event" } });
  }
  if (!["mood_pulse", "checkin", "ai_chat"].includes(event.source)) {
    return json(400, { ok: false, error: { code: "invalid_source" } });
  }
  // D7: precise coordinates are rejected at ingestion, server-side.
  if (event.location && (event.location.lat !== undefined || event.location.lng !== undefined)) {
    return json(400, { ok: false, error: { code: "precise_location_rejected" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(503, { ok: false, error: { code: "crisis_router_not_configured" } });
  }
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Active ruleset (pinned on every audit row for reproducibility).
  const { data: ruleset, error: rulesetError } = await db
    .from("crisis_rulesets")
    .select("version, rules_json")
    .order("active_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rulesetError || !ruleset) {
    return json(500, { ok: false, error: { code: "ruleset_not_configured" } });
  }
  const rules = ruleset.rules_json as {
    tiers: Record<string, { realert_minutes?: number }>;
    alert_copy_sms: string;
  };
  if (!rules.tiers || !rules.tiers[event.tier]) {
    return json(500, { ok: false, error: { code: "tier_not_in_ruleset" } });
  }

  const { data: child } = await db
    .from("children")
    .select("id, first_name")
    .eq("id", event.child_id)
    .maybeSingle();
  const teenFirstName =
    event.teen_first_name || (child as { first_name?: string } | null)?.first_name || "your teen";

  // T3: pattern signals never leave the teen account. Teen nudge only.
  if (event.tier === "T3") {
    const { data: crisisEvent } = await db
      .from("crisis_events")
      .insert({
        child_id: event.child_id,
        tier: "T3",
        ruleset_version: ruleset.version,
        source: event.source,
        detected_at: event.detected_at ?? new Date().toISOString(),
        inapp_card_shown_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    return json(200, {
      ok: true,
      tier: "T3",
      routed: false,
      teen_nudge: true,
      crisis_event_id: (crisisEvent as { id?: string } | null)?.id ?? null,
    });
  }

  // T1/T2: resolve the crisis routing chain. Verified, active, crisis_alert
  // role, priority order. Revoked parents are excluded: is_parent rows are
  // only eligible with a live grant (the 029 strip trigger deactivates them
  // on revoke; this re-checks the grant for defense in depth).
  const { data: adults } = await db
    .from("trusted_adults")
    .select("id, child_id, display_name, priority, is_parent, parent_user_id")
    .eq("child_id", event.child_id)
    .eq("is_active", true)
    .eq("verification_status", "verified")
    .contains("roles", ["crisis_alert"])
    .order("priority");
  const chain: TrustedAdult[] = [];
  for (const a of ((adults ?? []) as TrustedAdult[])) {
    if (a.is_parent && a.parent_user_id) {
      const { data: grant } = await db
        .from("child_access")
        .select("status")
        .eq("child_id", event.child_id)
        .eq("user_id", a.parent_user_id)
        .eq("role", "parent")
        .maybeSingle();
      if (!grant || (grant as { status: string }).status !== "active") continue;
    }
    chain.push(a);
  }

  // Informed-decline path: no adult will be alerted; in-app resources only.
  let declinedPath = false;
  if (chain.length === 0) {
    const { data: declined } = await db
      .from("access_events")
      .select("id")
      .eq("child_id", event.child_id)
      .eq("event_type", "crisis_alert.declined_path")
      .limit(1)
      .maybeSingle();
    declinedPath = !!declined;
  }

  const smsBody = (rules.alert_copy_sms as string).replace("{teen_first_name}", teenFirstName);
  const now = new Date().toISOString();

  async function contactOf(adultId: string): Promise<{ channel: string; value: string } | null> {
    const { data: contact } = await db
      .from("trusted_adult_contacts")
      .select("channel, vault_secret_id")
      .eq("trusted_adult_id", adultId)
      .maybeSingle();
    if (!contact) return null;
    const c = contact as { channel: string; vault_secret_id: string };
    const { data: secret } = await db
      .schema("vault")
      .from("decrypted_secrets")
      .select("decrypted_secret")
      .eq("id", c.vault_secret_id)
      .maybeSingle();
    const value = (secret as { decrypted_secret?: string } | null)?.decrypted_secret;
    if (!value) return null;
    return { channel: c.channel, value };
  }

  // Crisis event row first (audit continuity even if every channel fails).
  const { data: crisisEvent } = await db
    .from("crisis_events")
    .insert({
      child_id: event.child_id,
      tier: event.tier,
      ruleset_version: ruleset.version,
      source: event.source,
      detected_at: event.detected_at ?? now,
      inapp_card_shown_at: now,
      metadata: event.tier === "T1"
        ? { dfcs_evaluation: "pending_compliance_review" }
        : {},
    })
    .select("id")
    .single();
  const crisisEventId = (crisisEvent as { id?: string } | null)?.id ?? null;

  if (chain.length === 0) {
    // No verified adult reachable: in-app escalation to the teen.
    // We do NOT fall back to the parent (that reintroduces the G1
    // contradiction) — unless the decline path was chosen, in which case
    // in-app resources were the informed choice.
    await db.from("access_events").insert({
      child_id: event.child_id,
      event_type: "crisis_alert.no_reachable_adult",
      granted_by: "system",
      reason_code: event.tier === "T1" ? "crisis_t1_imminent" : "crisis_t2_ideation",
      metadata: {
        tier: event.tier,
        declined_path: declinedPath,
        crisis_event_id: crisisEventId,
      },
    });
    return json(200, {
      ok: true,
      tier: event.tier,
      routed: false,
      reason: declinedPath ? "declined_path" : "no_reachable_adult",
      teen_inapp_card: true,
      crisis_event_id: crisisEventId,
    });
  }

  // Alert chain: primary SMS -> email fallback -> secondary adult.
  let delivered: {
    adult: TrustedAdult;
    channel: string;
    status: string;
  } | null = null;
  let providerError: string | null = null;

  for (const adult of chain) {
    const contact = await contactOf(adult.id);
    if (!contact) continue;
    // This function delivers sms and email. app_push contacts fall through
    // to the next adult in the chain; push delivery is owned by the push
    // fan-out, which reads crisis_alerts rows (documented in api-contracts).
    if (contact.channel === "sms") {
      const result = await sendSms(contact.value, smsBody);
      if (result.ok) {
        delivered = { adult, channel: "sms", status: "sent" };
        break;
      }
      providerError = result.error ?? "crisis_sms_failed";
      if (result.error === "crisis_sms_provider_unconfigured") break;
      continue;
    }
    if (contact.channel === "email") {
      const emailed = await sendEmail(
        contact.value,
        "Pookie safety alert — please check on them now",
        smsBody,
      );
      if (emailed) {
        delivered = { adult, channel: "email", status: "sent" };
        break;
      }
    }
  }

  if (!delivered && providerError === "crisis_sms_provider_unconfigured") {
    // Fail LOUDLY: record the failure, do not silently skip.
    await db.from("crisis_alerts").insert({
      child_id: event.child_id,
      tier: event.tier,
      ruleset_version: ruleset.version,
      detection_source: event.source,
      trusted_adult_id: chain[0].id,
      channel: "sms",
      delivery_status: "failed",
      teen_inapp_card_shown: true,
    });
    await db.from("access_events").insert({
      child_id: event.child_id,
      event_type: "crisis_alert.sent",
      granted_by: "system",
      reason_code: event.tier === "T1" ? "crisis_t1_imminent" : "crisis_t2_ideation",
      metadata: {
        tier: event.tier,
        delivery_status: "failed",
        failure: "crisis_sms_provider_unconfigured",
        crisis_event_id: crisisEventId,
      },
    });
    return json(500, {
      ok: false,
      error: {
        code: "crisis_sms_provider_unconfigured",
        message:
          "SAFETY_SMS_WEBHOOK_URL is not configured. The alert was recorded as failed; configure the provider and re-fire.",
      },
    });
  }

  if (!delivered) {
    await db.from("access_events").insert({
      child_id: event.child_id,
      event_type: "crisis_alert.no_reachable_adult",
      granted_by: "system",
      reason_code: event.tier === "T1" ? "crisis_t1_imminent" : "crisis_t2_ideation",
      metadata: { tier: event.tier, chain_exhausted: true, crisis_event_id: crisisEventId },
    });
    return json(200, {
      ok: true,
      tier: event.tier,
      routed: false,
      reason: "no_reachable_adult",
      teen_inapp_card: true,
      crisis_event_id: crisisEventId,
    });
  }

  const { data: alertRow } = await db
    .from("crisis_alerts")
    .insert({
      child_id: event.child_id,
      tier: event.tier,
      ruleset_version: ruleset.version,
      detection_source: event.source,
      trusted_adult_id: delivered.adult.id,
      channel: delivered.channel,
      delivery_status: "sent",
      teen_inapp_card_shown: true,
    })
    .select("id")
    .single();

  await db.from("crisis_events").update({ alert_sent_at: now }).eq("id", crisisEventId);
  await db.from("access_events").insert({
    child_id: event.child_id,
    event_type: "crisis_alert.sent",
    granted_by: "system",
    reason_code: event.tier === "T1" ? "crisis_t1_imminent" : "crisis_t2_ideation",
    metadata: {
      tier: event.tier,
      trusted_adult_id: delivered.adult.id,
      channel: delivered.channel,
      crisis_event_id: crisisEventId,
      crisis_alert_id: (alertRow as { id?: string } | null)?.id ?? null,
    },
  });

  return json(200, {
    ok: true,
    tier: event.tier,
    routed: true,
    via: delivered.channel,
    trusted_adult_id: delivered.adult.id,
    crisis_event_id: crisisEventId,
    crisis_alert_id: (alertRow as { id?: string } | null)?.id ?? null,
    teen_inapp_card: true,
    // T1: the scheduler re-fires this function at +15 min if no ack arrived
    // (ack = the adult tapping the link in the SMS; tracked on crisis_alerts).
    realert_at:
      event.tier === "T1"
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null,
  });
});
