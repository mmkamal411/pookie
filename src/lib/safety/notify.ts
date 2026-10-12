// Server-only safety notification dispatch (Squad 1 Safety Track).
//
// Contract (see docs/squad1/api-contracts.md §notify): the SMS/email provider
// is a generic HTTPS webhook. POST JSON { to, body } (SMS) or
// { to, subject, body } (email) to SAFETY_SMS_WEBHOOK_URL /
// SAFETY_EMAIL_WEBHOOK_URL with `Authorization: Bearer <secret>`.
// The provider must answer 2xx with a JSON body containing { ok: true }.
// The crisis-router Edge Function uses this same contract.
//
// Failure is LOUD: a missing provider URL or a non-2xx response throws a
// SafetyNotifyError with a machine-readable code. Callers never silently
// skip a safety alert.

export class SafetyNotifyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SafetyNotifyError";
    this.code = code;
  }
}

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new SafetyNotifyError(
      "server_only",
      "safety/notify imported in a client bundle — forbidden.",
    );
  }
}

async function postWebhook(
  urlEnv: string,
  secretEnv: string,
  unconfiguredCode: string,
  payload: Record<string, string>,
): Promise<void> {
  assertServer();
  const url = process.env[urlEnv];
  if (!url) {
    throw new SafetyNotifyError(
      unconfiguredCode,
      `Safety notification provider is not configured (${urlEnv} is unset).`,
    );
  }
  const secret = process.env[secretEnv];
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new SafetyNotifyError(
      "provider_unreachable",
      `Safety notification provider request failed: ${(err as Error).message}`,
    );
  }
  if (!res.ok) {
    throw new SafetyNotifyError(
      "provider_rejected",
      `Safety notification provider answered HTTP ${res.status}.`,
    );
  }
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    throw new SafetyNotifyError(
      "provider_bad_response",
      "Safety notification provider did not return JSON.",
    );
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { ok?: unknown }).ok !== true
  ) {
    throw new SafetyNotifyError(
      "provider_bad_response",
      "Safety notification provider did not confirm delivery ({ ok: true }).",
    );
  }
}

/** Send an SMS via the configured safety provider. Throws SafetyNotifyError. */
export async function sendSafetySms(to: string, body: string): Promise<void> {
  if (!to || !to.trim()) {
    throw new SafetyNotifyError("recipient_required", "SMS recipient is empty.");
  }
  await postWebhook(
    "SAFETY_SMS_WEBHOOK_URL",
    "SAFETY_SMS_WEBHOOK_SECRET",
    "sms_provider_unconfigured",
    { to: to.trim(), body },
  );
}

/** Send an email via the configured safety provider. Throws SafetyNotifyError. */
export async function sendSafetyEmail(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  if (!to || !to.trim()) {
    throw new SafetyNotifyError("recipient_required", "Email recipient is empty.");
  }
  await postWebhook(
    "SAFETY_EMAIL_WEBHOOK_URL",
    "SAFETY_EMAIL_WEBHOOK_SECRET",
    "email_provider_unconfigured",
    { to: to.trim(), subject, body },
  );
}

/** Render the T1/T2 crisis SMS from the ruleset copy template. */
export function renderCrisisSms(template: string, teenFirstName: string): string {
  return template.replace("{teen_first_name}", teenFirstName || "your teen");
}
