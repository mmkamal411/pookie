// Squad 1 — Safety Track: shared types + backend contract.
//
// INTEGRATION POINT: awaits src/lib/safety/actions.ts — contract defined
// below (docs/squad1/api-contracts.md not yet published; the backend
// engineer implements this exact interface as Next.js server actions).
// Components call these actions for real data. Until the backend file
// lands, calls fail loudly through `missingActions` — never with mock data.

/** Standard result shape for every safety server action. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type TrustedAdultRelationship =
  | "parent"
  | "relative"
  | "counselor"
  | "coach"
  | "faith_leader"
  | "neighbor"
  | "other";

export type TrustedAdultRole = "crisis_alert" | "revoke_guardian" | "outing_contact";

export interface TrustedAdult {
  id: string;
  displayName: string;
  relationship: TrustedAdultRelationship;
  relationshipLabel: string;
  contactChannel: "sms" | "email";
  /** Masked for display, e.g. "(404) •••-1234" or "r•••@gmail.com". Never raw. */
  contactMasked: string;
  verificationStatus: "unverified" | "pending" | "verified" | "failed";
  roles: TrustedAdultRole[];
  note: string | null;
}

export interface NominateAdultInput {
  childProfileId: string;
  displayName: string;
  relationship: TrustedAdultRelationship;
  contactChannel: "sms" | "email";
  contactValue: string;
  note?: string;
  roles?: TrustedAdultRole[];
}

export type RevokeScope = "performance" | "communications" | "reflection" | "wellness";

export interface RevokePerson {
  id: string;
  firstName: string;
  relationshipToTeen: string;
  scopes: RevokeScope[];
}

export interface InitiateRevokeInput {
  childProfileId: string;
  granteeId: string;
  scopes: RevokeScope[];
  notifyMode: "at_effect" | "now";
  instant: boolean;
}

export interface PendingRevoke {
  id: string;
  granteeFirstName: string;
  scopes: RevokeScope[];
  effectAt: string;
  notifyMode: "at_effect" | "now";
  notifiedAt: string | null;
}

export type CrisisLevel = 3 | 4;

export interface TellAdultInput {
  trustedAdultId: string;
  tier: "presence" | "with_note";
  note?: string;
}

export interface ScreenTimeBudget {
  category: string;
  minutes: number;
}

export interface ScreenTimePlan {
  bedtimeWindDown: string;
  budgets: ScreenTimeBudget[];
  focusBlocks: { days: string; start: string; end: string }[];
}

export type ScreenTimeStatus =
  | "draft"
  | "proposed"
  | "active"
  | "change_requested";

export interface ScreenTimeState {
  status: ScreenTimeStatus;
  plan: ScreenTimePlan;
  teenName: string;
  parentName: string;
  lastChangeAt: string | null;
  lastChangeBy: "teen" | "parent" | null;
  proposedBy: "teen" | "parent" | null;
  appealReason: string | null;
  appealAt: string | null;
  appealResponse: string | null;
  appealRespondedAt: string | null;
}

export interface ScreenTimeAppeal {
  id: string;
  reason: string;
  createdAt: string;
  response: string | null;
  respondedAt: string | null;
}

export interface ExplorerSetupInput {
  childProfileId: string;
  outingContactAdultId: string;
  cardsAcknowledged: string[];
}

export interface EmergencyResource {
  id: string;
  name: string;
  detail: string;
  tel: string | null;
  sms: string | null;
  smsBody: string | null;
  note: string | null;
  sort: number;
}

export interface EmergencyMedical {
  bloodType: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  doctorName: string | null;
  doctorPhone: string | null;
  insuranceNote: string | null;
  /** Coarse only, per D7: city/ZIP, never precise. */
  homeArea: string | null;
}

export interface BreakGlassGrant {
  code: string;
  url: string;
  expiresAt: string;
  fields: string[];
}

export interface LabClass {
  id: string;
  className: string;
  teacherName: string | null;
  room: string | null;
  nursePhone: string | null;
}

export type ActionPlanKind = "allergy" | "asthma" | "seizure";

export interface ActionPlan {
  id: string;
  kind: ActionPlanKind;
  signs: string;
  meds: string;
  whoToCall: string;
  tell911: string;
  updatedAt: string;
}

export type BreakGlassRequesterKind = "trusted_adult" | "law_enforcement" | "teen_self" | "other";

export interface BreakGlassRequestInput {
  childProfileId: string;
  requesterKind: BreakGlassRequesterKind;
  requesterName: string;
  requesterContact: string;
  whatHappened: string;
  corroboration: {
    caseIdentifier: string | null;
    trustedAdultName: string | null;
    exigencyAttested: boolean;
  };
}

export type BreakGlassRequestState = "pending" | "approved" | "denied" | "expired";

export interface BreakGlassRequestStatus {
  requestId: string;
  state: BreakGlassRequestState;
  referenceCode: string;
  denialReason: string | null;
  updatedAt: string;
}

export interface GrantAllowance {
  trusted: { used: number; limit: number };
  newGrantee: { used: number; limit: number };
  resetsOn: string;
}

export interface GrantCandidate {
  id: string | null;
  name: string;
  email: string | null;
  kind: "trusted" | "new";
  lastGrantedAt: string | null;
  grantsInWindow: number;
}

export interface PendingGrantApproval {
  grantId: string;
  granteeName: string;
  granteeEmail: string | null;
  scopes: string[];
  requestedAt: string;
  requestedBy: string;
}

/**
 * The full backend contract for safety features. The backend engineer
 * implements each of these as a server action in
 * src/lib/safety/actions.ts and wires them to the migrations/RPCs in
 * docs/solutions/sol-safety.md (022 trusted_adults, 023 crisis,
 * 024 pending_revokes, 025 outing_plans, 026 emergency).
 */
export interface SafetyActions {
  // Trusted adults (§1)
  listTrustedAdults(childProfileId: string): Promise<ActionResult<TrustedAdult[]>>;
  nominateTrustedAdult(input: NominateAdultInput): Promise<ActionResult<{ trustedAdultId: string }>>;
  resendAdultVerification(trustedAdultId: string): Promise<ActionResult<void>>;
  deactivateTrustedAdult(trustedAdultId: string): Promise<ActionResult<void>>;
  declineTrustedAdult(childProfileId: string, ackVersion: string): Promise<ActionResult<void>>;

  // Cooling off / revoke (§3)
  initiateRevoke(input: InitiateRevokeInput): Promise<ActionResult<{ effectAt: string }>>;
  cancelRevoke(pendingRevokeId: string): Promise<ActionResult<void>>;
  safeExit(childProfileId: string, granteeIds: string[]): Promise<ActionResult<void>>;
  regrantAccess(granteeId: string): Promise<ActionResult<void>>;

  // Crisis card tell-a-trusted-adult (§2.3)
  tellTrustedAdult(input: TellAdultInput): Promise<ActionResult<void>>;

  // Screen time co-set (§7)
  getScreenTimeState(childProfileId: string): Promise<ActionResult<ScreenTimeState>>;
  proposeScreenTime(childProfileId: string, plan: ScreenTimePlan): Promise<ActionResult<void>>;
  reviewScreenTime(childProfileId: string, decision: "approve" | "counter" | "decline", plan: ScreenTimePlan, reason: string | null): Promise<ActionResult<void>>;
  appealScreenTime(childProfileId: string, reason: string): Promise<ActionResult<void>>;
  respondToAppeal(childProfileId: string, appealId: string, decision: "approve" | "deny", reason: string): Promise<ActionResult<void>>;
  listScreenTimeAppeals(childProfileId: string): Promise<ActionResult<ScreenTimeAppeal[]>>;

  // Explorer setup gate (§5)
  completeExplorerSetup(input: ExplorerSetupInput): Promise<ActionResult<void>>;

  // Emergency module W19 (§6)
  getEmergencyResources(regionCode: string): Promise<ActionResult<{ resources: EmergencyResource[]; verifiedAt: string }>>;
  getEmergencyMedical(childProfileId: string): Promise<ActionResult<EmergencyMedical | null>>;
  saveEmergencyMedical(childProfileId: string, medical: EmergencyMedical): Promise<ActionResult<void>>;
  createBreakGlassGrant(childProfileId: string, fields: string[]): Promise<ActionResult<BreakGlassGrant>>;
  listLabClasses(childProfileId: string): Promise<ActionResult<LabClass[]>>;
  listActionPlans(childProfileId: string): Promise<ActionResult<ActionPlan[]>>;
  saveActionPlan(
    childProfileId: string,
    plan: { id?: string; kind: ActionPlanKind; signs: string; meds: string; whoToCall: string; tell911: string }
  ): Promise<ActionResult<{ id: string }>>;
  deleteActionPlan(planId: string): Promise<ActionResult<void>>;

  // D1 — break-glass Path A (vendor human review, crisis-response provider TBD)
  submitBreakGlassRequest(input: BreakGlassRequestInput): Promise<ActionResult<{ requestId: string; referenceCode: string }>>;
  getBreakGlassRequestStatus(requestId: string): Promise<ActionResult<BreakGlassRequestStatus>>;

  // D6 — tiered grant caps
  getGrantAllowance(): Promise<ActionResult<GrantAllowance>>;
  listGrantCandidates(): Promise<ActionResult<GrantCandidate[]>>;
  requestGrant(granteeEmail: string, granteeName: string, scopes: string[]): Promise<ActionResult<{ grantId: string; needsTeenApproval: boolean }>>;
  listPendingGrantApprovals(childProfileId: string): Promise<ActionResult<PendingGrantApproval[]>>;
  decideGrantApproval(grantId: string, approved: boolean, reason: string | null): Promise<ActionResult<void>>;
}

function missing(name: string): never {
  throw new Error(
    `Safety backend not wired: "${name}". ` +
      `Implement it in src/lib/safety/actions.ts per the contract in src/components/safety/types.ts, ` +
      `then pass the real actions into this component via the "actions" prop.`
  );
}

/**
 * Temporary error-throwing stub used until src/lib/safety/actions.ts exists.
 * Every method throws an actionable error — no silent failures, no mock data.
 */
export const missingActions: SafetyActions = {
  listTrustedAdults: () => missing("listTrustedAdults"),
  nominateTrustedAdult: () => missing("nominateTrustedAdult"),
  resendAdultVerification: () => missing("resendAdultVerification"),
  deactivateTrustedAdult: () => missing("deactivateTrustedAdult"),
  declineTrustedAdult: () => missing("declineTrustedAdult"),
  initiateRevoke: () => missing("initiateRevoke"),
  cancelRevoke: () => missing("cancelRevoke"),
  safeExit: () => missing("safeExit"),
  regrantAccess: () => missing("regrantAccess"),
  tellTrustedAdult: () => missing("tellTrustedAdult"),
  getScreenTimeState: () => missing("getScreenTimeState"),
  proposeScreenTime: () => missing("proposeScreenTime"),
  reviewScreenTime: () => missing("reviewScreenTime"),
  appealScreenTime: () => missing("appealScreenTime"),
  respondToAppeal: () => missing("respondToAppeal"),
  listScreenTimeAppeals: () => missing("listScreenTimeAppeals"),
  completeExplorerSetup: () => missing("completeExplorerSetup"),
  getEmergencyResources: () => missing("getEmergencyResources"),
  getEmergencyMedical: () => missing("getEmergencyMedical"),
  saveEmergencyMedical: () => missing("saveEmergencyMedical"),
  createBreakGlassGrant: () => missing("createBreakGlassGrant"),
  listLabClasses: () => missing("listLabClasses"),
  listActionPlans: () => missing("listActionPlans"),
  saveActionPlan: () => missing("saveActionPlan"),
  deleteActionPlan: () => missing("deleteActionPlan"),
  submitBreakGlassRequest: () => missing("submitBreakGlassRequest"),
  getBreakGlassRequestStatus: () => missing("getBreakGlassRequestStatus"),
  getGrantAllowance: () => missing("getGrantAllowance"),
  listGrantCandidates: () => missing("listGrantCandidates"),
  requestGrant: () => missing("requestGrant"),
  listPendingGrantApprovals: () => missing("listPendingGrantApprovals"),
  decideGrantApproval: () => missing("decideGrantApproval"),
};

export const DECLINE_ACK_VERSION = "2026-10-12.v1";

/** Map machine error codes to plain, actionable UI copy. */
export function errorMessage(code: string): string {
  switch (code) {
    case "not_signed_in":
      return "You are signed out. Sign back in and try again.";
    case "rate_limited":
      return "Too many tries. Wait a few minutes and try again.";
    case "invalid_code":
      return "That code did not match. Check the message and try again.";
    case "code_locked":
      return "Too many wrong codes. Ask for a new one and try again.";
    case "cap_reached":
      return "You hit the sharing limit for this month. Try again after the reset date shown.";
    case "adult_required":
      return "Name a trusted adult (or choose 'no adult') first. This keeps a safety channel open.";
    default:
      return "Something did not work. Check your connection and try again.";
  }
}
