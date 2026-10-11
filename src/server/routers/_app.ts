import { router } from '../trpc';
import { childrenRouter, invitesRouter } from './children';

export const appRouter = router({
  children: childrenRouter,
  invites: invitesRouter,
});

export type AppRouter = typeof appRouter;
