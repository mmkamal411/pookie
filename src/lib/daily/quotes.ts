/**
 * Daily quote rotation — ported from d-dash (the 30 motivational lines
 * Mehedi added). Seeded so the same calendar day always yields the same
 * quote, with no repeats inside a 30-day window.
 */

export interface Quote {
  text: string;
  source: string;
}

const QUOTES: Quote[] = [
  { text: "Discipline is choosing what you want most over what you want now.", source: "Fight-mode fuel" },
  { text: "You don't have to be perfect. You have to be consistent.", source: "Fight-mode fuel" },
  { text: "Small wins, stacked daily, become unstoppable.", source: "Fight-mode fuel" },
  { text: "The test doesn't care how you feel. Prepare anyway.", source: "Fight-mode fuel" },
  { text: "An hour of focused work beats three hours of staring.", source: "Study note" },
  { text: "Champions are made when no one is watching.", source: "Fight-mode fuel" },
  { text: "Your future self is watching today's choices.", source: "Fight-mode fuel" },
  { text: "Start ugly. A rough draft beats a blank page.", source: "Study note" },
  { text: "The grade you want lives on the other side of the work you're avoiding.", source: "Fight-mode fuel" },
  { text: "Sleep is a study strategy. Protect it.", source: "Study note" },
  { text: "Confusion is the feeling of learning happening.", source: "Study note" },
  { text: "Ninety percent is a decision, not a gift.", source: "Fight-mode fuel" },
  { text: "Do the hardest thing first. The day gets easier from there.", source: "Study note" },
  { text: "Nobody remembers the score. Everybody remembers the effort.", source: "Fight-mode fuel" },
  { text: "Review beats reread. Test yourself, don't just look.", source: "Study note" },
  { text: "You are one focused week away from a different transcript.", source: "Fight-mode fuel" },
  { text: "Missing work is a choice. So is turning it in.", source: "Study note" },
  { text: "The OR is quiet, precise, and calm under pressure. Train like that now.", source: "Future Dr. Kamal" },
  { text: "A surgeon never wings it. Neither do you.", source: "Future Dr. Kamal" },
  { text: "Every problem set is practice for the problems that matter.", source: "Future Dr. Kamal" },
  { text: "Boring consistency beats exciting intensity.", source: "Fight-mode fuel" },
  { text: "Ask the question. Teachers respect the kid who cares.", source: "Study note" },
  { text: "Your competition is yesterday's version of you.", source: "Fight-mode fuel" },
  { text: "Twenty-five focused minutes. Then another. That's the whole secret.", source: "Study note" },
  { text: "Mistakes are data. Log them, learn them, leave them behind.", source: "Study note" },
  { text: "The students who ask for help finish ahead of the ones who don't.", source: "Study note" },
  { text: "Finish today's work today. Tomorrow has its own.", source: "Fight-mode fuel" },
  { text: "Calm is a competitive advantage. Breathe, then begin.", source: "Future Dr. Kamal" },
  { text: "You don't rise to the occasion. You fall to your preparation.", source: "Fight-mode fuel" },
  { text: "One more rep. One more problem. One more page. Then rest.", source: "Fight-mode fuel" },
];

/* ------------------------------------------------------------------ */
/* Seeded RNG (ported from d-dash daily-content.ts)                     */
/* ------------------------------------------------------------------ */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Days since Unix epoch for a YYYY-MM-DD date string (local, no TZ drift). */
function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function todayStr(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rotationPick<T>(bank: T[], dateStr: string, count: number): T[] {
  if (bank.length === 0) return [];
  const windowDays = Math.max(1, Math.floor(bank.length / count));
  const day = dayNumber(dateStr);
  const epoch = Math.floor(day / windowDays);
  const offset = (day % windowDays) * count;
  const shuffled = seededShuffle(bank, hashString(`epoch-${epoch}`));
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(shuffled[(offset + i) % shuffled.length]);
  return out;
}

/** Today's quote — stable for the whole calendar day. */
export function pickDailyQuote(dateStr: string = todayStr()): Quote {
  const [q] = rotationPick(QUOTES, dateStr, 1);
  return q ?? QUOTES[0];
}
