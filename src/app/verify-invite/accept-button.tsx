"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/lib/tenant/actions";

type State = { error: string | null };

/**
 * Calls the acceptInvite server action. On success the action redirect()s
 * to the dashboard; on failure (e.g. email mismatch — re-checked
 * server-side inside consume_invite) the friendly error renders inline.
 */
export function AcceptInviteButton({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async () => {
      const result = await acceptInvite(token);
      // redirect() on success never returns; only failures reach here.
      return { error: result.ok ? null : result.error };
    },
    { error: null },
  );

  return (
    <form action={formAction}>
      {state.error && (
        <p className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-stardust-200">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-nova-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Accepting…" : "Accept invite"}
      </button>
    </form>
  );
}
