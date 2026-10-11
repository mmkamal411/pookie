// GET /api/v1/children — all children in the caller's tenant set.
// Drives the child switcher. RLS scopes rows via current_child_ids();
// the route asserts an authenticated session via the wrapper.
// Read-only list: no per-child audit (audit_event requires a single child_id).
import { handleRoute } from '@/server/rest';
import { listMyChildren } from '@/server/services/children';

export const GET = handleRoute(async () => listMyChildren());
