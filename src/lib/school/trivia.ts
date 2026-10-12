// "Did You Know?" rotating facts — school-friendly, curiosity-first.
// The overview picks a deterministic fact per day (day-of-year rotation),
// and the user can shuffle for another. Title Case copy.

export interface TriviaFact {
  text: string;
  source: string;
  sourceUrl?: string;
}

export const TRIVIA_FACTS: TriviaFact[] = [
  {
    text: "Honey never spoils — archaeologists found 3,000-year-old honey in Egyptian tombs that was still edible.",
    source: "Smithsonian",
    sourceUrl: "https://www.si.edu",
  },
  {
    text: "Octopuses have three hearts and blue blood — two hearts stop beating when they swim, which is why they prefer crawling.",
    source: "National Geographic",
    sourceUrl: "https://www.nationalgeographic.com",
  },
  {
    text: "The Eiffel Tower grows about 15 cm taller in summer as its iron expands in the heat.",
    source: "Toureiffel.paris",
    sourceUrl: "https://www.toureiffel.paris",
  },
  {
    text: "Your brain generates about 20 watts of electrical power — enough to dimly light a bulb.",
    source: "Neuroscience",
  },
  {
    text: "Geometry's proofs use the same logic as computer programs: assumptions in, conclusions out, no skipped steps.",
    source: "Study Insight",
  },
  {
    text: "Students who explain a lesson out loud (the protégé effect) remember up to 90% of it a week later.",
    source: "Learning Science",
  },
  {
    text: "AP Computer Science Principles covers binary, algorithms, and the internet — the exam is 70% multiple choice.",
    source: "College Board",
    sourceUrl: "https://apstudents.collegeboard.org",
  },
  {
    text: "Chinese characters are logograms: each one represents a meaning, not a sound — there are over 50,000 in total.",
    source: "Language Facts",
  },
  {
    text: "The American government has three branches by design — Congress, the President, and the courts check each other's power.",
    source: "Civics",
  },
  {
    text: "Environmental science studies how populations grow: exponential growth looks flat until it suddenly doesn't.",
    source: "Study Insight",
  },
  {
    text: "Shakespeare invented or popularized over 1,700 English words — including 'eyeball', 'bedroom', and 'fashionable'.",
    source: "Oxford English Dictionary",
    sourceUrl: "https://www.oed.com",
  },
  {
    text: "Sleep is when your brain files away the day's learning — a full night's sleep beats an all-nighter every time.",
    source: "Sleep Science",
  },
  {
    text: "The HOPE Scholarship needs a 3.0 GPA in core classes — every tenth of a point counts.",
    source: "GAfutures",
    sourceUrl: "https://www.gafutures.org",
  },
  {
    text: "Missing work is the fastest grade killer: a single zero can drag a category average down by double digits.",
    source: "Study Insight",
  },
];

/** Deterministic daily pick — the whole family sees the same fact today. */
export function triviaForDate(date: Date): TriviaFact {
  const dayNum = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
  return TRIVIA_FACTS[dayNum % TRIVIA_FACTS.length];
}
