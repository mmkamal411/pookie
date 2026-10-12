// apiHandler — the single wrapper every /api/v1 route uses.
//
// Layers on top of the existing handleRoute (@/server/rest), which already
// provides: request-id generation + correlation, authenticated-session gate,
// and the canonical envelope { ok, data } / { ok:false, error:{code,message} }
// with typed ErrorCodes.
//
// apiHandler adds the scope-filtering choke point (FR-ACCESS-006):
//   1. resolve the child this request's data belongs to (opts.childId —
//      literal, or a resolver for body/query-derived ids),
//   2. resolve the viewer's visible scopes server-side (resolveVisibleScopes),
//   3. run the handler with ctx.scopes / ctx.isTeen,
//   4. filter the handler's payload with applyScopeFilter BEFORE
//      serialization — no route can forget, and teen-private scopes
//      (reflection, wellness) can never leak to parents.
//
// Service convention: child-data rows carry a `_scope` tag (see withScope());
// applyScopeFilter drops out-of-scope rows and strips the tags.
import type { NextRequest } from 'next/server';
import { handleRoute, type RouteContext } from '@/server/rest';
import { applyScopeFilter } from './scopes';
import { resolveVisibleScopes, type ViewerScopes } from './db';

export interface ApiHandlerOptions {
  /**
   * The child this request's data belongs to. Omit for non-child routes
   * (no scope filtering). A resolver receives (ctx, req) — for body-derived
   * ids, read via req.clone() so the handler can still parse the body.
   */
  childId?:
    | string
    | ((ctx: RouteContext, req: NextRequest) => string | null | Promise<string | null>);
}

export interface ScopedRouteContext extends RouteContext {
  /** The resolved child id, or null when the route is not child-scoped. */
  childId: string | null;
  /** The viewer's resolved scopes, or null when the route is not child-scoped. */
  scopes: ViewerScopes | null;
}

type RouteParams = Record<string, string | string[]>;

export function apiHandler<P extends RouteParams = RouteParams>(
  opts: ApiHandlerOptions,
  handler: (ctx: ScopedRouteContext & { params: P }, req: NextRequest) => Promise<unknown>,
) {
  return handleRoute<P>(async (ctx, req) => {
    const raw =
      typeof opts.childId === 'function' ? await opts.childId(ctx, req) : (opts.childId ?? null);

    let scoped: ScopedRouteContext & { params: P } = { ...ctx, childId: raw, scopes: null };
    if (raw) {
      const viewerScopes = await resolveVisibleScopes(ctx.userId, raw);
      scoped = { ...ctx, childId: raw, scopes: viewerScopes };
    }

    const data = await handler(scoped, req);

    // Choke point: filter BEFORE serialization. Structured worker/AI payloads
    // that tag rows with _scope are filtered here too (SEC-004).
    if (scoped.scopes) {
      return applyScopeFilter(data, new Set(scoped.scopes.scopes), {
        isTeen: scoped.scopes.isTeen,
      });
    }
    return data;
  });
}
