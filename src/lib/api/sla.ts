// SLA engine — PURE functions (no I/O). Window-aware first-response SLA:
// 4 hours inside the 09:00–17:00 America/New_York window, 7 days/week
// (FR-SUPPORT-003). MD decision D4: holidays keep the same window but route
// to the rotating on-call agent.
//
// Examples: Mon 10:00 ET -> due 14:00 ET same day.
//           Fri 16:00 ET -> due Mon 10:00 ET (1h left rolls to next window).
//           Holiday 23:00 ET -> due 13:00 ET next day (D4 example).

export const SUPPORT_WINDOW_START_HOUR_ET = 9;
export const SUPPORT_WINDOW_END_HOUR_ET = 17;
export const FIRST_RESPONSE_SLA_HOURS = 4;

/** US federal holidays (ET dates) incl. observed days, 2026–2028. */
const HOLIDAYS: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Presidents' Day",
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-03': 'Independence Day (observed)',
  '2026-09-07': 'Labor Day',
  '2026-10-12': 'Columbus Day',
  '2026-11-11': "Veterans Day",
  '2026-11-26': 'Thanksgiving',
  '2026-12-25': 'Christmas Day',
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King Jr. Day',
  '2027-02-15': "Presidents' Day",
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth (observed)',
  '2027-07-05': 'Independence Day (observed)',
  '2027-09-06': 'Labor Day',
  '2027-10-11': 'Columbus Day',
  '2027-11-11': "Veterans Day",
  '2027-11-25': 'Thanksgiving',
  '2027-12-24': 'Christmas Day (observed)',
  '2027-12-31': "New Year's Day (observed)",
  '2028-01-17': 'Martin Luther King Jr. Day',
  '2028-02-21': "Presidents' Day",
  '2028-05-29': 'Memorial Day',
  '2028-06-19': 'Juneteenth',
  '2028-07-04': 'Independence Day',
  '2028-09-04': 'Labor Day',
  '2028-10-09': 'Columbus Day',
  '2028-11-10': "Veterans Day (observed)",
  '2028-11-23': 'Thanksgiving',
  '2028-12-25': 'Christmas Day',
};

// ---------------------------------------------------------------------------
// America/New_York date math (no external deps)
// ---------------------------------------------------------------------------

interface EtParts { y: number; mo: number; d: number; h: number; mi: number }

const etFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function etParts(date: Date): EtParts {
  const p: Record<string, string> = {};
  for (const part of etFmt.formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  // hour12:false can yield '24' at midnight in some ICU builds.
  const h = Number(p['hour']) % 24;
  return {
    y: Number(p['year']), mo: Number(p['month']), d: Number(p['day']),
    h, mi: Number(p['minute']),
  };
}

/** ET calendar date key, e.g. '2026-10-12'. */
export function etDateKey(date: Date): string {
  const p = etParts(date);
  const mm = String(p.mo).padStart(2, '0');
  const dd = String(p.d).padStart(2, '0');
  return `${p.y}-${mm}-${dd}`;
}

/** Convert an ET wall-clock time to a UTC instant (iterative, DST-safe). */
function etToUtc(y: number, mo: number, d: number, h: number, mi: number): Date {
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 4; i++) {
    const p = etParts(new Date(guess));
    const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    const target = Date.UTC(y, mo - 1, d, h, mi);
    const delta = target - asUtc;
    guess += delta;
    if (Math.abs(delta) < 1000) break;
  }
  return new Date(guess);
}

function addDaysEt(parts: EtParts, n: number): EtParts {
  const utc = etToUtc(parts.y, parts.mo, parts.d, 12, 0);
  return etParts(new Date(utc.getTime() + n * 86_400_000));
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

// ---------------------------------------------------------------------------
// Holidays + on-call rotation (D4)
// ---------------------------------------------------------------------------

/** True when the instant falls on a US federal holiday (ET calendar). */
export function isSupportHoliday(at: Date): boolean {
  return etDateKey(at) in HOLIDAYS;
}

/** Holiday display name, or null. */
export function holidayName(at: Date): string | null {
  return HOLIDAYS[etDateKey(at)] ?? null;
}

/**
 * Default on-call slot: alternating ISO weeks across the ordered agent list.
 * Even ISO week -> agents[0], odd -> agents[1], etc. A support_oncall row for
 * the date overrides this (see resolveOnCallAgent).
 */
export function defaultOnCallIndex(at: Date, agentCount: number): number {
  if (agentCount <= 0) return -1;
  return isoWeek(at) % agentCount;
}

/**
 * Resolve the on-call agent id for an instant.
 * @param agents ordered agent ids (stable order, e.g. by created_at)
 * @param overrides map of ET date key -> agent id (from support_oncall)
 */
export function resolveOnCallAgent(
  at: Date,
  agents: string[],
  overrides: Map<string, string>,
): string | null {
  const key = etDateKey(at);
  const override = overrides.get(key);
  if (override && agents.includes(override)) return override;
  const idx = defaultOnCallIndex(at, agents.length);
  return idx >= 0 ? agents[idx] : null;
}

// ---------------------------------------------------------------------------
// SLA computation
// ---------------------------------------------------------------------------

/**
 * Compute sla_due_at: `slaHours` of support-window time after `createdAt`.
 * The window is 09:00–17:00 ET, 7 days/week (holidays included — D4 keeps the
 * window and routes to on-call instead of pausing the clock).
 */
export function computeSlaDueAt(createdAt: Date, slaHours: number = FIRST_RESPONSE_SLA_HOURS): Date {
  if (!(slaHours > 0)) throw new Error('slaHours must be positive');
  let remainingMs = slaHours * 3_600_000;
  let cursor = new Date(createdAt.getTime());

  for (let i = 0; i < 400 && remainingMs > 0; i++) {
    const p = etParts(cursor);
    const windowStart = etToUtc(p.y, p.mo, p.d, SUPPORT_WINDOW_START_HOUR_ET, 0);
    const windowEnd = etToUtc(p.y, p.mo, p.d, SUPPORT_WINDOW_END_HOUR_ET, 0);

    if (cursor.getTime() < windowStart.getTime()) {
      cursor = windowStart; // before today's window: start at 09:00
    } else if (cursor.getTime() >= windowEnd.getTime()) {
      const next = addDaysEt(p, 1);
      cursor = etToUtc(next.y, next.mo, next.d, SUPPORT_WINDOW_START_HOUR_ET, 0);
      continue;
    }
    const available = windowEnd.getTime() - cursor.getTime();
    if (remainingMs <= available) {
      return new Date(cursor.getTime() + remainingMs);
    }
    remainingMs -= available;
    const next = addDaysEt(etParts(windowEnd), 1);
    cursor = etToUtc(next.y, next.mo, next.d, SUPPORT_WINDOW_START_HOUR_ET, 0);
  }
  throw new Error('computeSlaDueAt: exceeded iteration guard');
}

export type SlaState = 'on-track' | 'breached';

export interface SlaTicket {
  sla_due_at: Date | string;
  sla_breached: boolean;
  status: string;
}

/**
 * slaStatus(ticket, now): 'on-track' | 'breached'.
 * A persisted sla_breached flag always wins; terminal states stop the clock.
 */
export function slaStatus(ticket: SlaTicket, now: Date = new Date()): SlaState {
  if (ticket.sla_breached) return 'breached';
  if (ticket.status === 'resolved' || ticket.status === 'closed') return 'on-track';
  return new Date(ticket.sla_due_at).getTime() < now.getTime() ? 'breached' : 'on-track';
}

/** Milliseconds remaining until sla_due_at (negative when breached). */
export function slaRemainingMs(ticket: Pick<SlaTicket, 'sla_due_at'>, now: Date = new Date()): number {
  return new Date(ticket.sla_due_at).getTime() - now.getTime();
}
