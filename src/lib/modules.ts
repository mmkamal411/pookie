// The module directory — 7 popup categories, plain job names.
// (Mehedi 2026-10-12: popup bottom-sheet with collapsed categories;
//  W10 Fairness and W17 Friends removed; W6 → "Driving School" in Marketplace;
//  W14 Co-parenting → Home; W15 Screen Time → Safety.)
// Statuses: "live" (real route, real data) or "seedling" (taking root —
// elegant placeholder with one seed-it-now action, never "coming soon").
// Client-safe: the menu popup renders this directly.
//
// Age gating (FR-MENU-004, sol-ux §9): `minAge` hides a module when the viewer
// is below that age; `hideForTeen` hides it from teen accounts outright
// (hidden, never locked — a locked tile invites workarounds).
// `teenPrivate` modules show parents a locked tile (FR-MENU-005).

export type ModuleStatus = "live" | "seedling";

export interface LifeModule {
  id: string;
  name: string;
  watchOver: string;
  seedAction: string;
  status: ModuleStatus;
  /** Route under /c/[childSlug] — null until the module's workstream ships it.
   *  A route starting with "/" is absolute (household / marketplace namespace). */
  route: string | null;
  teenPrivate?: boolean;
  /**
   * Minimum viewer age — the module is hidden when the viewer's age is below
   * this (FR-MENU-004). Client-side only; server enforces real access.
   */
  minAge?: number;
  /**
   * Hide entirely from teen accounts (13–17). Hidden, not locked — a locked
   * tile teaches teens what they're missing (sol-ux §9).
   */
  hideForTeen?: boolean;
}

export interface Grove {
  name: string;
  subtitle: string;
  sigil: string;
  modules: LifeModule[];
}

export const GROVES: Grove[] = [
  {
    name: "Health",
    subtitle: "the body you live in",
    sigil: "💚",
    modules: [
      { id: "W2", name: "Health", watchOver: "Vitals, trends, and gentle glanceables — the body you live in.", seedAction: "Connect your health app", status: "live", route: "/health" },
      { id: "W8", name: "Wellbeing", watchOver: "The mood pulse — how the day actually felt.", seedAction: "Start the daily pulse", status: "live", route: "/health/wellbeing", teenPrivate: true },
      { id: "W13", name: "Meals", watchOver: "What's for dinner — planned, not panicked.", seedAction: "Plan this week's meals", status: "live", route: "/health/meals" },
      { id: "W22", name: "Activity", watchOver: "Steps, workouts, the movement log — training for the mission, logged by hand.", seedAction: "Log your first workout", status: "live", route: "/health/activity" },
      { id: "W23", name: "Nutrition", watchOver: "Fuel for the day — learning and meal ideas, never calorie or weight-loss tracking for teens.", seedAction: "Explore food & fuel", status: "live", route: "/health/nutrition" },
    ],
  },
  {
    name: "Home",
    subtitle: "what lands at your door and on your table",
    sigil: "🏡",
    modules: [
      { id: "W21", name: "Mail", watchOver: "What landed at your door — snap, read, action cards.", seedAction: "Snap your first envelope", status: "live", route: "/household/mail" },
      { id: "W20", name: "Shopping List", watchOver: "One shared list for the whole household.", seedAction: "Start the list", status: "live", route: "/household/shopping" },
      { id: "W11", name: "Spending", watchOver: "Where the money went — patterns, not judgment.", seedAction: "Connect your bank", status: "live", route: "/household/spending" },
      { id: "W7", name: "Money & Documents", watchOver: "The ledger and the vault — every dollar, every document.", seedAction: "Add your first account", status: "live", route: "/household/vault" },
      { id: "W24", name: "Credit", watchOver: "Minor security-freeze management + credit-hygiene coaching — not bureau monitoring.", seedAction: "Set up a security freeze", status: "live", route: "/credit", minAge: 18 },
      { id: "W14", name: "Co-parenting", watchOver: "Parallel parenting — two surfaces, an immutable log, no messaging.", seedAction: "Log your first pickup", status: "live", route: "/coparenting" },
    ],
  },
  {
    name: "School",
    subtitle: "the school years, handled",
    sigil: "🌿",
    modules: [
      { id: "W1", name: "School", watchOver: "Grades, assignments, and the path to 90.", seedAction: "", status: "live", route: "/school" },
      { id: "W16", name: "School Calendar", watchOver: "Holidays, early releases — the school year at a glance. Lives inside School.", seedAction: "Sync the school calendar", status: "seedling", route: null },
      { id: "W5", name: "College & Future", watchOver: "Where grades open doors — colleges, simulators, the long path.", seedAction: "Start the college list", status: "seedling", route: null },
      { id: "W4", name: "Activities", watchOver: "Practice, games, rehearsals — the activity web.", seedAction: "Add the first activity", status: "seedling", route: null },
      { id: "W18", name: "Summer", watchOver: "Summer, handled — camps, plans, the long break.", seedAction: "Sketch this summer", status: "seedling", route: null },
    ],
  },
  {
    name: "Safety",
    subtitle: "the insurance drawer, and the boundaries that hold",
    sigil: "🛡️",
    modules: [
      { id: "W3", name: "Safety", watchOver: "Policies and coverage — peace of mind, organized.", seedAction: "Add your first policy", status: "live", route: "/household/insurance" },
      { id: "W19", name: "Emergency", watchOver: "When seconds count — the plan, the numbers, the vault.", seedAction: "Build the emergency plan", status: "seedling", route: null },
      { id: "W15", name: "Screen Time", watchOver: "Screens with sanity — limits that actually stick.", seedAction: "Set the first boundary", status: "live", route: "/safety/screen-time" },
    ],
  },
  {
    name: "Travel",
    subtitle: "getting around, and the world beyond the door",
    sigil: "🌍",
    modules: [
      { id: "W25", name: "Fuel & Charging", watchOver: "Cheapest gas, nearest chargers — vehicle-aware.", seedAction: "What do you drive?", status: "live", route: "/travel/fuel" },
      { id: "W30", name: "Flights", watchOver: "Fly smarter — fare prediction, family-trip math.", seedAction: "Name a dream trip", status: "live", route: "/travel/flights", hideForTeen: true, minAge: 18 },
      { id: "W31", name: "Rental Cars", watchOver: "The real total cost — no $29/day traps.", seedAction: "Add your loyalty programs", status: "live", route: "/travel/rentals", hideForTeen: true, minAge: 18 },
      { id: "W27", name: "Events", watchOver: "What's happening near you — AI-curated, family-fit.", seedAction: "What does your family love?", status: "live", route: "/travel/events" },
      { id: "W28", name: "Restaurants", watchOver: "Where should we eat tonight — taste-learned, not stars.", seedAction: "Build your taste profile", status: "live", route: "/travel/restaurants" },
      { id: "W29", name: "Trails & Parks", watchOver: "Where can we go outside — conditions, kid-friendliness.", seedAction: "Set your home location", status: "live", route: "/travel/trails" },
      { id: "W26", name: "Weather", watchOver: "The sky over your day — hyperlocal, decision-ready.", seedAction: "Where does your day happen?", status: "live", route: "/household/weather" },
    ],
  },
  {
    name: "Marketplace",
    subtitle: "trusted services, found",
    sigil: "🤝",
    modules: [
      { id: "W12", name: "Babysitters", watchOver: "Trusted sitters — who, when, what they need to know.", seedAction: "Add your first sitter", status: "live", route: "/marketplace" },
      { id: "W6", name: "Driving School", watchOver: "Driving, skills, independence — becoming, step by step.", seedAction: "Find a driving school", status: "live", route: "/marketplace", minAge: 15 },
    ],
  },
  {
    name: "Support",
    subtitle: "help, when you need it",
    sigil: "💬",
    modules: [
      { id: "S1", name: "Help Center & FAQ", watchOver: "Answers to common questions — searchable, plain-language.", seedAction: "Browse the help center", status: "live", route: "/support/faq" },
      { id: "S2", name: "AI Support Chat", watchOver: "Instant answers from Pookie's support assistant, 24/7.", seedAction: "Start a chat", status: "live", route: "/support/chat" },
      { id: "S3", name: "Support Tickets", watchOver: "Open a ticket, track it, talk to a human.", seedAction: "Open your first ticket", status: "live", route: "/support/tickets" },
    ],
  },
];

export const MODULE_COUNT = GROVES.reduce((n, g) => n + g.modules.length, 0);
