// /api/v1/household/activity/[workoutId] — Activity Tracking (Phase1 W22).
// DELETE — remove a logged workout
import { handleRoute } from "@/server/rest";
import { deleteWorkout } from "@/server/services/activity";

export const DELETE = handleRoute<{ workoutId: string }>(async (ctx) => {
  return deleteWorkout(ctx.params.workoutId);
});
