// /api/v1/household/tasks — Family Task System (Squad Value).
// GET  — list tasks (household members; RLS enforced)
// POST — create task
import { handleRoute } from "@/server/rest";
import {
  createTask,
  listTasks,
  taskCreateSchema,
  taskListQuerySchema,
} from "@/server/services/tasks";

export const GET = handleRoute(async (_ctx, req) => {
  const { status, due } = taskListQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listTasks(status, due);
});

export const POST = handleRoute(async (_ctx, req) => {
  const body = taskCreateSchema.parse(await req.json());
  return createTask(body);
});
