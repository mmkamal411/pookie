// W5 essay AI-feedback — STUB call site. Do not build the AI here.
//
// Contract for the future provider (when wired):
//   * tenant-partitioned: one invocation = one child_id; never batch children.
//   * never trained on: drafts are inference input only, never training data.
//   * output is child-facing → must pass the safety review gate before render.
//
// v1 returns deterministic mechanical checks only, clearly marked stub:true.
// The feedback route persists nothing (009 has no feedback column by design).
import type { EssayFeedback } from "@/lib/college/types";

export interface EssayFeedbackInput {
  prompt: string;
  draft: string;
  word_limit: number | null;
}

function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export async function requestEssayFeedback(
  input: EssayFeedbackInput,
): Promise<EssayFeedback> {
  // STUB — no AI provider is called. Replace this body when a provider is
  // wired (see contract above). Everything below is local and deterministic.
  const words = countWords(input.draft);
  const checks: EssayFeedback["checks"] = [];
  if (input.word_limit) {
    const pct = Math.round((words / input.word_limit) * 100);
    checks.push({
      label: "Length",
      detail:
        words === 0
          ? "No draft text yet."
          : `${words} of ${input.word_limit} words (${pct}%). ` +
            (pct > 100 ? "Over the limit — trim before submitting." : pct < 50 ? "Well under the limit — keep developing." : "In a healthy range."),
    });
  } else {
    checks.push({ label: "Length", detail: words === 0 ? "No draft text yet." : `${words} words.` });
  }
  checks.push({
    label: "Prompt",
    detail: "Confirm the draft answers the prompt above in the student's own voice.",
  });
  return {
    stub: true,
    word_count: words,
    word_target: input.word_limit,
    checks,
    message:
      "AI feedback is not connected yet — these are mechanical checks only. " +
      "A parent or counselor review is the real gate before this essay ships.",
  };
}
