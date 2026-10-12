// /api/v1/household/activity/steps — manual step logging (Phase1 W22).
// Device sync arrives in a later phase; steps are typed in by hand.
// GET  — today's steps + goal and the trailing 7 days (optional child_id)
// POST — log steps and/or set the daily goal for a date
import { handleRoute } from "@/server/rest";
import {
  getSteps,
  logSteps,
  stepsLogSchema,
  stepsQuerySchema,
} from "@/server/services/activity";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export const GET = handleRoute(async (_ctx, req) => {
  const { logged_date, child_id } = stepsQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return getSteps(logged_date ?? todayLocal(), child_id);
});

export const POST = handleRoute(async (_ctx, req) => {
  const body = stepsLogSchema.parse(await req.json());
  return logSteps(body);
});
