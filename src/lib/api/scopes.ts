// Scope-filtering primitives — PURE functions, no I/O, no framework imports.
// This is the reviewable core of the server-side choke point (FR-ACCESS-006,
// sol-access §2.5). The DB function public.resolve_visible_scopes() is the
// enforcement point in SQL; these mirror its semantics in TypeScript so the
// apiHandler wrapper can filter payloads before serialization, and so the
// Security Engineer can unit-test the logic without a database.
//
// Contract for services: any child-data row returned to the API layer carries
// a `_scope` tag naming its visibility scope. applyScopeFilter() drops rows
// whose tag is not in the viewer's resolved set, then strips the tags.
// Wellness rows additionally carry `_healthTier` (H0–H3); H0/H2/H3 never leave
// the teen's own session (sol-access §2.1, EXPERT-SOLUTIONS §G C1).

export const SCOPES = [
  'performance',
  'communications',
  'reflection',
  'wellness',
  'location',
  'itinerary',
  'safety_comms',
] as const;

export type Scope = (typeof SCOPES)[number];

/** Scopes that are teen-private by default and must never leak to parents. */
export const TEEN_PRIVATE_SCOPES: readonly Scope[] = ['reflection', 'wellness'];

export type HealthTier = 'H0' | 'H1' | 'H2' | 'H3';

export interface ScopeResolution {
  /** The viewer's own child_access row is role='child' (the teen). */
  isTeen: boolean;
  /** Grant status when the viewer is a grantee; null for teen/stranger. */
  grantStatus: 'active' | 'pending_cooling' | 'revoked' | 'suspended_court' | 'scheduled_revoke' | null;
  /** Scopes with allowed=true on the viewer's access_scopes rows. */
  allowedScopes: Scope[];
}

const SCOPE_SET = new Set<string>(SCOPES);

/** Sanitize a raw scope list (e.g. from the DB) to known scopes only. */
export function sanitizeScopes(raw: readonly string[]): Scope[] {
  const out: Scope[] = [];
  for (const s of raw) {
    if (SCOPE_SET.has(s) && !out.includes(s as Scope)) out.push(s as Scope);
  }
  return out;
}

/**
 * Pure mirror of public.resolve_visible_scopes().
 *   teen                                    -> all 7 scopes
 *   active / cooling grantee                -> allowed scopes + safety_comms
 *   revoked / suspended / never-linked      -> safety_comms only
 */
export function resolveVisibleScopesPure(input: ScopeResolution): Scope[] {
  if (input.isTeen) return [...SCOPES];
  if (input.grantStatus === 'active' || input.grantStatus === 'pending_cooling' || input.grantStatus === 'scheduled_revoke') {
    // Sorted: matches the SQL choke point's ORDER BY (deterministic output).
    const allowed = sanitizeScopes(input.allowedScopes).sort();
    return allowed.includes('safety_comms') ? allowed : [...allowed, 'safety_comms'];
  }
  return ['safety_comms'];
}

export function hasScopePure(resolution: ScopeResolution, scope: Scope): boolean {
  return resolveVisibleScopesPure(resolution).includes(scope);
}

// ---------------------------------------------------------------------------
// Payload filtering
// ---------------------------------------------------------------------------

type Tagged = Record<string, unknown>;

function isTagged(value: unknown): value is Tagged {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A row is dropped when its _scope tag is outside the viewer's set. */
function rowVisible(row: Tagged, visible: Set<Scope>, isTeen: boolean): boolean {
  const scope = row['_scope'];
  if (typeof scope === 'string') {
    if (!visible.has(scope as Scope)) return false;
    // Wellness H-tier filter (sol-access §2.1): H1 flows with the wellness
    // scope; H2/H3 are teen-private; H0 never leaves the teen's session.
    if (scope === 'wellness') {
      const tier = row['_healthTier'];
      if (tier === 'H0' || tier === 'H2' || tier === 'H3') return isTeen;
    }
  }
  return true;
}

/** Remove scope bookkeeping tags before serialization (never leak them). */
function stripTags(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTags);
  if (isTagged(value)) {
    const out: Tagged = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '_scope' || k === '_healthTier') continue;
      out[k] = stripTags(v);
    }
    return out;
  }
  return value;
}

function filterValue(value: unknown, visible: Set<Scope>, isTeen: boolean): unknown {
  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    for (const item of value) {
      if (isTagged(item) && !rowVisible(item, visible, isTeen)) continue;
      kept.push(filterValue(item, visible, isTeen));
    }
    return kept;
  }
  if (isTagged(value)) {
    if (!rowVisible(value, visible, isTeen)) return undefined;
    const out: Tagged = {};
    for (const [k, v] of Object.entries(value)) {
      const fv = filterValue(v, visible, isTeen);
      if (fv !== undefined) out[k] = fv;
    }
    return out;
  }
  return value;
}

export interface FilterOptions {
  /** True when the viewer is the teen themself (H2/H3/H0 rows stay). */
  isTeen: boolean;
}

/**
 * Drop every tagged row outside `visible`, then strip all tags.
 * Untagged data passes through untouched (non-child payloads).
 */
export function applyScopeFilter<T>(data: T, visible: Set<Scope>, opts: FilterOptions): T {
  const filtered = filterValue(data, visible, opts.isTeen);
  return stripTags(filtered === undefined ? null : filtered) as T;
}

/** Tag a row with its visibility scope (service-layer convention). */
export function withScope<T extends object>(row: T, scope: Scope, healthTier?: HealthTier): T {
  const tagged = row as Tagged;
  tagged['_scope'] = scope;
  if (healthTier !== undefined) tagged['_healthTier'] = healthTier;
  return row;
}
