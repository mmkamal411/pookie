// GET /api/v1/formulas?subject=math|science&version=
// FR-SCHOOL-018 (G19): the versioned, two-expert-verified formula bank — the
// single grounding source for quizzes, sparks math content, tutor math, SAT.
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { listFormulas } from "@/server/services/quiz";

const querySchema = z.object({
  subject: z.enum(["math", "science"]),
  version: z.string().max(40).optional(),
});

export const GET = handleRoute(async (ctx, req) => {
  const { subject, version } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listFormulas(subject, version);
});
