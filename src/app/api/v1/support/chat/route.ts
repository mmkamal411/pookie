// POST /api/v1/support/chat — S2 AI support chat.
//
// Proxies to the real pookie-tutor Worker (Llama 3.3 70B) with the
// support-scoped system prompt + optional FAQ article context. The worker
// URL comes from POOKIE_TUTOR_URL (server) — when unset, the route returns
// an honest "configuration needed" state and the UI escalates to S3.
//
// D2 gate: the "never train on your data" claim MUST NOT appear in any
// user-visible copy until NFR-PRIVACY-010 (DPA verification) is recorded.
// The disclosure below states only what S2 does today.

import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes } from "@/server/errors";

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
  article_slug: z.string().max(120).optional(),
});

const SUPPORT_SYSTEM = [
  "You are Pookie's support assistant — an AI, not a person. You help with support intents only:",
  "how-to questions, troubleshooting, account help, and billing questions.",
  "Rules you never break:",
  "- You CANNOT see the user's private data: no grades, no health, no check-ins, no messages. Never claim to look them up.",
  "- You CANNOT delete or export accounts, and you make no promises about the law.",
  "- Answer from the Pookie help articles when they are provided as context; say when you are unsure.",
  "- Keep answers short, plain, and kind (8th-grade reading level).",
  "- If the user asks for a human, or you cannot confidently help after a few tries, say so plainly",
  '  and offer: "Want me to bring in a human?"',
  "- Never produce a guessed answer when your confidence is low.",
].join("\n");

export const POST = handleRoute(async (_ctx, req) => {
  const body = chatSchema.parse(await req.json());
  const workerUrl =
    (process.env.POOKIE_TUTOR_URL ?? process.env.NEXT_PUBLIC_POOKIE_TUTOR_URL ?? "").replace(/\/$/, "");

  if (!workerUrl) {
    return {
      status: "configuration_needed",
      message:
        "Pookie's AI is not connected right now — open a ticket and a human will pick it up. Nothing you typed is lost.",
    };
  }

  const messages = [
    { role: "user", text: `[SYSTEM: ${SUPPORT_SYSTEM}]` },
    ...(body.article_slug
      ? [
          {
            role: "user",
            text: `[CONTEXT: the user was reading the help article "${body.article_slug}". Use it to ground your answer.]`,
          },
        ]
      : []),
    ...body.messages.map((m) => ({
      role: m.role === "assistant" ? "pookie" : "user",
      text: m.content,
    })),
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${workerUrl}/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-20), mode: "support" }),
    });
    if (!res.ok) throw new Error(`tutor ${res.status}`);
    const data = (await res.json()) as { reply?: unknown };
    const reply = typeof data.reply === "string" ? data.reply.trim() : "";
    if (!reply) throw new Error("empty reply");
    return { status: "ok", reply };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  } finally {
    clearTimeout(timer);
  }
});
