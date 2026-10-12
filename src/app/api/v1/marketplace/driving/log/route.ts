// /api/v1/marketplace/driving/log — W6 Joshua's Law hours log.
//
// GET  ?child_id=      → progress vs the state requirement
//                        ({ total_minutes, night_minutes, targets, pct })
// POST {child_id, drive_date, minutes_total, minutes_night, supervisor_name, conditions}
//                      → append a drive (append-only; edits create new rows)
//
// Coded against the pending rpc_log_driving_hours /
// rpc_driving_hours_progress contract. Until those RPCs land, the route
// reads/writes the real `driving_log` table directly (PENDING Unit P3);
// when the table is missing entirely it returns an honest
// "service initializing" state — never fabricated hours.

import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";
import { DRIVING_HOUR_TARGETS } from "@/lib/marketplace/driving-rules-seed";

const logSchema = z.object({
  child_id: z.string().uuid(),
  drive_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes_total: z.number().int().min(1).max(1440),
  minutes_night: z.number().int().min(0).default(0),
  supervisor_name: z.string().min(1).max(120),
  conditions: z.string().max(200).optional(),
});

function initializing() {
  return {
    status: "service_initializing",
    message:
      "The driving log is still being connected — your drives will save here once the log table is live. Nothing is lost; there is just nowhere to put it yet.",
  };
}

export const GET = handleRoute(async (_ctx, req) => {
  const childId = new URL(req.url).searchParams.get("child_id") ?? "";
  const state = (new URL(req.url).searchParams.get("state") ?? "GA").trim().toUpperCase();
  if (!/^[0-9a-f-]{36}$/i.test(childId)) failWith(ErrorCodes.VALIDATION_FAILED);

  const supabase = await createClient();
  const targets = DRIVING_HOUR_TARGETS[state] ?? DRIVING_HOUR_TARGETS.GA;

  try {
    // Prefer the pending RPC when it exists.
    const { data: rpcData, error: rpcError } = await supabase.rpc("rpc_driving_hours_progress", {
      p_child_id: childId,
    });
    if (!rpcError && rpcData) return { status: "ok", ...(rpcData as object) };
    if (rpcError && !/function .* does not exist|42883|PGRST202|Could not find the function/i.test(rpcError.message ?? "")) throw rpcError;

    // Fall back to direct table read (PENDING table; RLS family-scoped).
    const { data, error } = await supabase
      .from("driving_log")
      .select("minutes_total, minutes_night, drive_date, supervisor_name, conditions")
      .eq("child_id", childId)
      .order("drive_date", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const total = rows.reduce((s, r) => s + (r.minutes_total as number), 0);
    const night = rows.reduce((s, r) => s + (r.minutes_night as number), 0);
    return {
      status: "ok",
      total_minutes: total,
      night_minutes: night,
      total_target: targets.total,
      night_target: targets.night,
      pct_total: Math.min(100, Math.round((total / targets.total) * 100)),
      pct_night: Math.min(100, Math.round((night / targets.night) * 100)),
      entries: rows.slice(0, 20),
      entry_count: rows.length,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|42P01|does not exist/i.test(msg)) return initializing();
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
});

export const POST = handleRoute(async (ctx, req) => {
  const body = logSchema.parse(await req.json());
  if (body.minutes_night > body.minutes_total) failWith(ErrorCodes.VALIDATION_FAILED);
  if (body.drive_date > new Date().toISOString().slice(0, 10)) failWith(ErrorCodes.VALIDATION_FAILED);

  const supabase = await createClient();
  try {
    // Prefer the pending RPC when it exists.
    const { data: rpcData, error: rpcError } = await supabase.rpc("rpc_log_driving_hours", {
      p_child_id: body.child_id,
      p_drive_date: body.drive_date,
      p_minutes_total: body.minutes_total,
      p_minutes_night: body.minutes_night,
      p_supervisor_name: body.supervisor_name,
      p_conditions: body.conditions ?? null,
    });
    if (!rpcError && rpcData) return { status: "ok", entry_id: rpcData };
    if (rpcError && !/function .* does not exist|42883|PGRST202|Could not find the function/i.test(rpcError.message ?? "")) throw rpcError;

    // Fall back to direct insert (append-only; RLS family-scoped).
    const { data, error } = await supabase
      .from("driving_log")
      .insert({
        child_id: body.child_id,
        logged_by: ctx.userId,
        drive_date: body.drive_date,
        minutes_total: body.minutes_total,
        minutes_night: body.minutes_night,
        supervisor_name: body.supervisor_name,
        conditions: body.conditions ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { status: "ok", entry_id: (data as { id: string }).id };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|42P01|does not exist/i.test(msg)) return initializing();
    throw new ApiError(ErrorCodes.INTERNAL);
  }
});
