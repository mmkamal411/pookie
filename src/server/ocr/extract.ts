// W21 mail intelligence — deterministic field extraction from OCR text.
// Spec §3.3 step 3: classification via keyword rules; amount via currency
// regex; due_date via date parser. The parsed date must appear VERBATIM in
// ocr_text (the vision's rule — never the LLM's guess). Extraction runs only
// on real readings (confidence > 0); the v1 stub returns 0, so nothing is
// extracted from its placeholder text.
//
// Classification bias: LOW false negatives. When in doubt, surface it — junk
// requires strong multi-signal evidence; everything else defaults to 'other'.

export type MailClassification =
  | 'bill'
  | 'tax'
  | 'legal'
  | 'insurance'
  | 'medical'
  | 'school'
  | 'personal'
  | 'other'
  | 'junk';

export interface ExtractedFields {
  classification: MailClassification;
  classificationConfidence: number;
  amount: number | null;
  accountLast4: string | null;
  dueDate: string | null; // ISO yyyy-mm-dd
  sender: string | null;
}

const KEYWORDS: Record<Exclude<MailClassification, 'other'>, string[]> = {
  bill: [
    'amount due',
    'balance due',
    'payment due',
    'past due',
    'amount owed',
    'please pay',
    'statement date',
    'billing statement',
    'invoice',
    'account balance',
    'minimum payment',
    'total due',
    'due date',
  ],
  tax: [
    '1099',
    'w-2',
    'w2',
    'irs',
    'internal revenue',
    'tax return',
    'property tax',
    'tax bill',
    'form 1040',
    'tax year',
  ],
  legal: [
    'court',
    'summons',
    'subpoena',
    'attorney',
    'lawsuit',
    'notice of hearing',
    'default judgment',
    'eviction',
    'garnishment',
    'legal notice',
  ],
  insurance: [
    'policy number',
    'premium',
    'deductible',
    'claim number',
    'explanation of benefits',
    'eob',
    'coverage',
    'coinsurance',
    'open enrollment',
  ],
  medical: [
    'patient',
    'visit summary',
    'lab results',
    'prescription',
    'copay',
    'co-pay',
    'diagnosis',
    'referral',
    'appointment',
  ],
  school: [
    'walton',
    'cobb county',
    'school district',
    'report card',
    'principal',
    'teacher',
    'attendance',
    'school year',
    'grade level',
    'enrollment',
    'school lunch',
  ],
  personal: [
    'birthday',
    'congratulations',
    'thank you',
    'with love',
    'happy holidays',
    'graduation',
    'wedding',
    'sympathy',
    'greeting card',
  ],
  junk: [
    'presorted standard',
    'or current resident',
    'unsubscribe',
    'sweepstakes',
    "you've won",
    'you have won',
    'act now',
    'limited time offer',
    'no purchase necessary',
    'bulk rate',
  ],
};

/** Classify OCR text. Junk needs a margin of ≥2 signals, else it stays 'other'. */
export function classifyMail(text: string): {
  classification: MailClassification;
  confidence: number;
} {
  const lower = text.toLowerCase();
  const scores = new Map<MailClassification, number>();
  for (const [cls, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) if (lower.includes(w)) score += 1;
    scores.set(cls as MailClassification, score);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const [, secondScore] = ranked[1];
  if (topScore === 0) return { classification: 'other', confidence: 0.2 };
  if (top === 'junk' && topScore - secondScore < 2) {
    // Weak junk signal — surface it instead of dismissing.
    return { classification: 'other', confidence: 0.3 };
  }
  // Rough confidence: share of matched signals, capped.
  const total = [...scores.values()].reduce((a, b) => a + b, 0);
  const confidence = Math.min(0.95, 0.4 + 0.5 * (topScore / Math.max(1, total)));
  return { classification: top, confidence: Math.round(confidence * 100) / 100 };
}

const AMOUNT_RE = /\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))/g;
const DUE_HINT_RE = /(due|amount due|balance due|pay by|payment due|total due)/i;

/**
 * Extract the amount: largest dollar figure on a line carrying due-date
 * language wins. Ties → null + human review (never guess between equals).
 */
export function extractAmount(text: string): number | null {
  const candidates: number[] = [];
  for (const line of text.split('\n')) {
    if (!DUE_HINT_RE.test(line)) continue;
    for (const m of line.matchAll(AMOUNT_RE)) {
      const n = parseFloat(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0 && n < 10_000_000) candidates.push(n);
    }
  }
  if (candidates.length === 0) return null;
  const max = Math.max(...candidates);
  const ties = candidates.filter((c) => c === max).length;
  return ties > 1 ? null : Math.round(max * 100) / 100;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// Positional groups (named groups need ES2018+; tsconfig targets ES2017).
// `fields` maps capture group i+1 to its semantic name.
const DATE_PATTERNS: { re: RegExp; fields: Array<'m' | 'mon' | 'd' | 'y'> }[] = [
  // 10/31/2026 or 10-31-2026 or 10.31.2026
  { re: /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/, fields: ['m', 'd', 'y'] },
  // October 31, 2026
  { re: /([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/, fields: ['mon', 'd', 'y'] },
  // 31 October 2026
  { re: /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/, fields: ['d', 'mon', 'y'] },
  // 2026-10-31
  { re: /(\d{4})-(\d{2})-(\d{2})/, fields: ['y', 'm', 'd'] },
];

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const check = new Date(`${iso}T12:00:00Z`);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() + 1 !== m ||
    check.getUTCDate() !== d
  )
    return null; // e.g. Feb 30 — not a real date
  return iso;
}

/**
 * Parse the due date: scan lines with due-language first, then the whole text.
 * A candidate is accepted only if its SOURCE SUBSTRING appears verbatim in
 * ocr_text and parses to a real calendar date. Returns null on ambiguity
 * (two different dates on due-lines → human review).
 */
export function extractDueDate(text: string): string | null {
  const lines = text.split('\n');
  const dueLines = lines.filter((l) => DUE_HINT_RE.test(l));
  const pools = [dueLines, lines];
  for (const pool of pools) {
    const found = new Set<string>();
    for (const line of pool) {
      for (const { re, fields } of DATE_PATTERNS) {
        const m = line.match(re);
        if (!m || !m[0]) continue;
        // Verbatim check: the matched substring must be in the raw text.
        if (!text.includes(m[0])) continue;
        const g: Record<string, string | undefined> = {};
        fields.forEach((f, i) => {
          g[f] = m[i + 1];
        });
        const mon = g.mon?.toLowerCase();
        const month = g.m ? parseInt(g.m, 10) : mon ? (MONTHS[mon] ?? 0) : 0;
        const iso = toIso(
          parseInt(g.y ?? '0', 10),
          month,
          parseInt(g.d ?? '0', 10),
        );
        if (iso) found.add(iso);
      }
    }
    if (found.size === 1) return [...found][0];
    if (found.size > 1) return null; // ambiguous — human review
  }
  return null;
}

/** Last-4 only. The full number is re-viewed from the photo, never stored. */
export function extractAccountLast4(text: string): string | null {
  const m = text.match(
    /(?:account|acct\.?|policy|member)(?:\s*(?:number|no\.?|#))?[^0-9a-z]{0,25}(\d{4})\b/i,
  );
  return m ? m[1] : null;
}

/** Sender heuristic: first substantive line (envelope sender), ≤80 chars. */
export function extractSender(text: string): string | null {
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.length >= 3 && t.length <= 80 && /[a-zA-Z]/.test(t)) return t;
  }
  return null;
}

/**
 * Extract-then-mask (NFR-PRIVACY-009, GIPA). OCR extracts FIRST; then every
 * digit run of 8+ (card/account/SSN shapes, separators allowed) is replaced
 * with **** + last-4 BEFORE the text is persisted to ocr_text. Masking is
 * lossy by design — the raw number only ever lives in the photo.
 * Mirrors public.mask_account_numbers() in migration 024.
 */
export function maskAccountNumbers(text: string): string {
  if (!text) return text;
  return text.replace(/(?<!\d)\d(?:[\s-]?\d){7,}(?!\d)/g, (run) => {
    const digits = run.replace(/\D/g, '');
    if (digits.length < 8) return run;
    return `****${digits.slice(-4)}`;
  });
}

/** All distinct amounts found on due-hint lines (for extracted_amounts[]). */
export function extractAllAmounts(text: string): number[] {
  const found = new Set<number>();
  for (const line of text.split('\n')) {
    if (!DUE_HINT_RE.test(line)) continue;
    for (const m of line.matchAll(AMOUNT_RE)) {
      const n = parseFloat(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0 && n < 10_000_000) {
        found.add(Math.round(n * 100) / 100);
      }
    }
  }
  return [...found].sort((a, b) => b - a);
}

/** Full deterministic extraction pass. Confidence 0 → skip (stub reading). */
export function extractMailFields(
  text: string,
  confidence: number,
): ExtractedFields {
  if (confidence <= 0) {
    return {
      classification: 'other',
      classificationConfidence: 0,
      amount: null,
      accountLast4: null,
      dueDate: null,
      sender: null,
    };
  }
  const { classification, confidence: cc } = classifyMail(text);
  return {
    classification,
    classificationConfidence: cc,
    amount: extractAmount(text),
    accountLast4: extractAccountLast4(text),
    dueDate: extractDueDate(text),
    sender: extractSender(text),
  };
}

// ---------------------------------------------------------------------------
// Reminders: 7-day + 2-day before the due date; weekend landings shift to the
// prior Friday (deterministic — the vision's deadline reasoning, in code).
// ---------------------------------------------------------------------------

function shiftWeekendToFriday(d: Date): Date {
  const day = d.getUTCDay();
  const out = new Date(d);
  if (day === 6) out.setUTCDate(out.getUTCDate() - 1); // Sat → Fri
  if (day === 0) out.setUTCDate(out.getUTCDate() - 2); // Sun → Fri
  return out;
}

/** reminder_at candidates for a due date (ISO yyyy-mm-dd), 09:00 local. */
export function computeReminderTimes(dueDateIso: string): {
  sevenDay: string;
  twoDay: string;
} {
  const due = new Date(`${dueDateIso}T12:00:00Z`);
  const at = (daysBefore: number): string => {
    const d = new Date(due);
    d.setUTCDate(d.getUTCDate() - daysBefore);
    const shifted = shiftWeekendToFriday(d);
    shifted.setUTCHours(9, 0, 0, 0);
    return shifted.toISOString();
  };
  return { sevenDay: at(7), twoDay: at(2) };
}
