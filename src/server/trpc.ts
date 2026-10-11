// tRPC v11 setup: context, tenant-scoped procedure, error shaping.
// Every procedure that touches tenant data uses tenantProcedure with a
// `{ childId }` input — the middleware asserts membership before the handler runs.
import { initTRPC, TRPCError } from '@trpc/server';
import { randomUUID } from 'crypto';
import superjson from 'superjson';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes } from './errors';
import { assertTenant, type TenantContext } from './tenant';

export interface Context {
  requestId: string;
  tenant: TenantContext | null;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, ctx }) => ({
    ...shape,
    data: {
      ...shape.data,
      // Normalize to the canonical envelope: { code, message, requestId }.
      code: shape.message as string, // canonical ErrorCode thrown via trpcError()
      requestId: ctx?.requestId ?? 'unknown',
    },
  }),
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Base procedure: attaches requestId + Supabase session user (no tenant assertion). */
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const requestId = randomUUID();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: ErrorCodes.TENANT_SCOPE_VIOLATION });
  }
  return next({ ctx: { ...ctx, requestId, userId: user.id } });
});

const tenantInput = z.object({ childId: z.string().uuid() });

/**
 * tenantProcedure: for tenant-scoped queries/mutations.
 * Input MUST include `{ childId }`. Membership is asserted before the handler runs.
 */
export const tenantProcedure = authedProcedure.input(tenantInput).use(async ({ ctx, input, next }) => {
  const tenant = await assertTenant(input.childId);
  return next({ ctx: { ...ctx, tenant } as Context });
});
