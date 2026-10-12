// /api/v1/household/activity — Activity Tracking (Phase1 W22).
// GET  — list workouts + summary (range=week|month, optional child_id)
// POST — log a workout
import { handleRoute } from "@/server/rest";
import {
  activityListQuerySchema,
  createWorkout,
  listActivity,
  workoutCreateSchema,
} from "@/server/services/activity";

export const GET = handleRoute(async (_ctx, req) => {
  const { range, child_id } = activityListQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listActivity(range, child_id);
});

export const POST = handleRoute(async (_ctx, req) => {
  const body = workoutCreateSchema.parse(await req.json());
  return createWorkout(body);
});
