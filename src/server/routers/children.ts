import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createClient } from '@/lib/supabase/server';
import { router, tenantProcedure, authedProcedure } from '../trpc';
import { mapDbError } from '../errors';
import { listMyChildren, getChild } from '../services/children';

export const childrenRouter = router({
  /** All children in the caller's tenant set (drives the child switcher). */
  listMine: authedProcedure.query(async () => listMyChildren()),

  /** One child by id — membership asserted by tenantProcedure. */
  get: tenantProcedure.query(async ({ ctx }) => getChild(ctx.tenant!.childId)),
});

export const invitesRouter = router({
  /** Consume an invite token after OTP login. Wraps the consume_invite() RPC. */
  consume: authedProcedure
    .input(z.object({ token: z.string().min(16).max(128) }))
    .mutation(async ({ input, ctx }) => {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc('consume_invite', { p_token: input.token });
      if (error) {
        const code = mapDbError(error, ctx.requestId);
        throw new TRPCError({ code: 'BAD_REQUEST', message: code });
      }
      return { childId: data as string };
    }),
});
