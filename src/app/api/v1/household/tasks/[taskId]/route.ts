// /api/v1/household/tasks/[taskId] — Family Task System (Squad Value).
// PATCH  — update task (title, due, priority, status, assignment…)
// DELETE — delete task
import { handleRoute } from "@/server/rest";
import { deleteTask, patchTask, taskPatchSchema } from "@/server/services/tasks";

export const PATCH = handleRoute<{ taskId: string }>(async (ctx, req) => {
  const body = taskPatchSchema.parse(await req.json());
  return patchTask(ctx.params.taskId, body);
});

export const DELETE = handleRoute<{ taskId: string }>(async (ctx) => {
  return deleteTask(ctx.params.taskId);
});
