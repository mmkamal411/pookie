// Shared shapes for the family (child account management) feature.
// Imported by server actions and client views alike —
// plain types only, no "use server" boundary here.

export type FamilyRole = "parent" | "child";

export interface FamilyLogin {
  email: string;
  displayName: string | null;
  role: FamilyRole;
  /** ISO timestamp the login was linked to the child. */
  linkedAt: string;
}

export interface FamilyMember {
  childId: string;
  firstName: string;
  nickname: string | null;
  slug: string;
  avatarUrl: string | null;
  schoolName: string | null;
  gradeLevel: string | null;
  /** ISO date (YYYY-MM-DD) or null — drives the 18+ independence gate. */
  dateOfBirth: string | null;
  logins: FamilyLogin[];
}

export interface PendingInvite {
  id: string;
  email: string;
  childId: string;
  childName: string;
  /** ISO timestamp the invite was sent. */
  sentAt: string;
  /** ISO timestamp the invite expires. */
  expiresAt: string;
  /** Parent-visible so they can share the link manually. */
  token: string;
}

export interface IndependenceStatus {
  /** False when the caller doesn't hold a child role anywhere. */
  isChild: boolean;
  childId?: string;
  childName?: string;
  dateOfBirth?: string | null;
  /** Full years, or null when the birthday isn't saved. */
  age?: number | null;
  eligible?: boolean;
  /** ISO date they turn 18, when known and under 18. */
  turnsEighteenOn?: string | null;
}
