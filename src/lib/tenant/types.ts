export type TenantRole = "parent" | "child";

export interface TenantChild {
  id: string;
  slug: string;
  first_name: string;
  nickname: string | null;
  avatar_url: string | null;
  school_name: string | null;
  grade_level: string | null;
}

export interface TenantMembership {
  child_id: string;
  role: TenantRole;
  child: TenantChild;
}

/** Cookie holding the session's active tenant. HttpOnly, set server-side only. */
export const ACTIVE_CHILD_COOKIE = "pookie_active_child";
