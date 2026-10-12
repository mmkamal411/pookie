import { redirect } from "next/navigation";
import {
  getAccountDeletionStatus,
  cancelAccountDeletion,
} from "@/lib/account/actions";
import { signOut } from "@/lib/tenant/actions";
import { PookieOrb } from "@/components/pookie-orb";

export const dynamic = "force-dynamic";

/**
 * /account-deleted — grace-period recovery page.
 *
 * Shown instead of the app when the signed-in user's account is pending
 * deletion. Offers: cancel and restore everything, or keep the deletion
 * (sign out). The purge date is shown plainly — no surprises.
 */
export default async function AccountDeletedPage() {
  const status = await getAccountDeletionStatus();
  if (!status) redirect("/login");
  if (!status.pending) redirect("/");

  const purgeDate = status.permanentDeleteAfter
    ? new Date(status.permanentDeleteAfter).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "the scheduled date";

  async function handleRestore() {
    "use server";
    const result = await cancelAccountDeletion();
    if (result.ok) redirect("/");
  }

  return (
    <main className="relative flex min-h-screen min-h-dvh items-center justify-center bg-nebula-950 px-6">
      <div className="card-living w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto flex w-fit">
          <PookieOrb size={64} />
        </div>
        <h1 className="text-sunlit mt-5 text-2xl font-semibold">
          This Account Is Scheduled for Deletion
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stardust-300">
          Everything will be permanently erased on{" "}
          <strong className="text-white">{purgeDate}</strong>. Until then,
          your data is hidden but intact — nothing is gone yet.
        </p>
        <form action={handleRestore} className="mt-6">
          <button
            type="submit"
            className="btn-dapple w-full rounded-2xl py-3 text-sm font-semibold text-nebula-950"
          >
            Cancel deletion and restore everything
          </button>
        </form>
        <p className="mt-4 text-xs text-stardust-400">
          Changed your mind for good? Just sign out and let the date pass —
          no further action needed.
        </p>
        {/* Prism E5 2026-10-12: the copy told users to sign out but offered
            no sign-out control. */}
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="neon-hover neon-teal neon-active w-full rounded-2xl border border-white/15 py-2.5 text-sm font-medium text-stardust-300 transition-all hover:border-nova-400/50 hover:text-nova-200"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
