/**
 * Deletion grace periods (days). Founder-confirmed 2026-10-12.
 *
 * When a user requests deletion (account or child), rows are soft-marked
 * with permanent_delete_after = now() + grace days. A nightly job
 * (purge_expired_deletions, migration 063) hard-deletes expired rows.
 * During grace the user sees recovery UX and can cancel.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;
export const CHILD_DELETION_GRACE_DAYS = 30;

/** Exact phrase the user must type to confirm account deletion. */
export const ACCOUNT_DELETE_CONFIRM_PHRASE = "DELETE";
