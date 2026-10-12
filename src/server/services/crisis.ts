// Crisis-language detection — pure deterministic tripwire (FR-AI-001).
// Dependency-free: the chat layer calls detectCrisisLanguage() on user text.
// The chat layer EMITS events via handleCrisisSignal(); it does not decide.
export type SafetyEventType =
  | "crisis_language"
  | "abuse_disclosure"
  | "mandatory_reporter_tripwire"
  | "self_harm_plan"
  | "eating_disorder_signal";

const CRISIS_PATTERNS: ReadonlyArray<{ pattern: RegExp; type: SafetyEventType }> = [
  { pattern: /\b(kill (myself|me)|end (my|it all)|suicid\w*|self[- ]?harm|cutting myself|hurt myself)\b/i, type: "self_harm_plan" },
  { pattern: /\b(want to die|better off dead|no reason to live|can't go on)\b/i, type: "crisis_language" },
  { pattern: /\b(touch\w* me|molest\w*|rape\w*|sexual\w* (abuse|assault))\b/i, type: "abuse_disclosure" },
  { pattern: /\b(someone (is )?hurting me|hits me|beats me|abuses? me)\b/i, type: "abuse_disclosure" },
  { pattern: /\b(starving myself|purg\w+|throwing up (my )?food|binge\w*)\b/i, type: "eating_disorder_signal" },
];

/** Fixed, teen-readable handoff script (sol-school-ai §16.2 — meaning fixed). */
export const CRISIS_HANDOFF_SCRIPT =
  "Thank you for telling me — that took guts. I need to be straight with you: " +
  "I can't keep this just between us, because your safety matters more than secrecy. " +
  "You deserve support from a real person right now: call or text 988 anytime, " +
  "or text HOME to 741741 (Crisis Text Line).";

/** Deterministic crisis-language detection. Returns the matched event type or null. */
export function detectCrisisLanguage(text: string): SafetyEventType | null {
  for (const { pattern, type } of CRISIS_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return null;
}

export interface CrisisSignalResult {
  eventId: string;
  type: SafetyEventType;
  severity: "watch" | "urgent" | "imminent";
  handoffScript: string;
}

