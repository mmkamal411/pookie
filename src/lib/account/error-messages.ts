/**
 * Machine-readable deletion error codes → plain English.
 * Single source of truth shared by the danger-zone UI, the remove-child
 * flow, and the account-deleted recovery page. Matches the copy style of
 * src/lib/onboarding/error-messages.ts: plain, calm, no jargon.
 */
export function deletionErrorMessage(code: string): string {
  switch (code) {
    case "not_signed_in":
      return "You're not signed in anymore. Please sign in again.";
    case "not_authenticated":
      return "We couldn't confirm who you are. Please sign in again and retry.";
    case "no_deletion_pending":
      return "There's no deletion scheduled — nothing to cancel.";
    case "not_child_owner":
      return "We couldn't find that child on your account.";
    case "child_id_required":
      return "Something's missing — please try again.";
    case "already_requested":
      return "A deletion is already scheduled for this account.";
    case "deletion_failed":
      return "Couldn't schedule that deletion. Please try again.";
    case "cancel_failed":
      return "Couldn't cancel that deletion. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
