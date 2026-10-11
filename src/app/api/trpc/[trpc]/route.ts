// tRPC HTTP handler (App Router). Edge-compatible: fetch adapter, no Node APIs.
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({ requestId: '', tenant: null }),
  });
}

export { handler as GET, handler as POST };
