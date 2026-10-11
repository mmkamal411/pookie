// Framework-free business logic. Handlers (REST/actions) are thin adapters:
// validate → resolve tenant → call service → shape response. No framework imports here.
import { createClient } from '@/lib/supabase/server';

export interface ChildSummary {
  id: string;
  firstName: string;
  nickname: string | null;
  slug: string;
  schoolName: string | null;
  gradeLevel: string | null;
}

export async function listMyChildren(): Promise<ChildSummary[]> {
  const supabase = await createClient();
  // RLS scopes this to the caller's tenant set via current_child_ids().
  const { data, error } = await supabase
    .from('children')
    .select('id, first_name, nickname, slug, school_name, grade_level')
    .eq('status', 'active')
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    firstName: c.first_name,
    nickname: c.nickname,
    slug: c.slug,
    schoolName: c.school_name,
    gradeLevel: c.grade_level,
  }));
}

export async function getChild(childId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('children')
    .select('id, first_name, last_name, nickname, slug, school_name, district, grade_level, timezone, avatar_url')
    .eq('id', childId)
    .single();
  if (error) throw error;
  return data;
}

export interface CreateChildInput {
  firstName: string;
  lastName: string;
  nickname?: string | null;
  slug?: string | null;
  schoolName?: string | null;
  gradeLevel?: string | null;
  timezone?: string | null;
}

/**
 * Create a child via the create_child() RPC (SECURITY DEFINER): inserts the
 * child row + the caller's parent access row atomically. Requires the caller
 * to already hold a parent role somewhere (or the invite path for the first
 * child). Returns the new child id.
 */
export async function createChild(input: CreateChildInput): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_child', {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_nickname: input.nickname ?? null,
    p_slug: input.slug ?? null,
    p_school_name: input.schoolName ?? null,
    p_grade_level: input.gradeLevel ?? null,
    p_timezone: input.timezone ?? 'America/New_York',
  });
  if (error) throw error;
  return { id: data as string };
}

/**
 * Editable child fields. Deliberately narrower than the DB column GRANT:
 * slug is excluded (stable URL identity for /c/[childSlug]), status is owned
 * by the archive path, grade_scale/is_default are internal.
 */
export interface UpdateChildInput {
  firstName?: string;
  lastName?: string;
  nickname?: string | null;
  schoolName?: string | null;
  district?: string | null;
  gradeLevel?: string | null;
  dateOfBirth?: string | null;
  studentId?: string | null;
  timezone?: string | null;
  avatarUrl?: string | null;
}

const UPDATE_COLUMN_MAP: Record<keyof UpdateChildInput, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  nickname: 'nickname',
  schoolName: 'school_name',
  district: 'district',
  gradeLevel: 'grade_level',
  dateOfBirth: 'date_of_birth',
  studentId: 'student_id',
  timezone: 'timezone',
  avatarUrl: 'avatar_url',
};

export async function updateChild(childId: string, input: UpdateChildInput) {
  const supabase = await createClient();
  const patch: Record<string, string | null> = {};
  for (const [key, column] of Object.entries(UPDATE_COLUMN_MAP)) {
    const value = input[key as keyof UpdateChildInput];
    if (value !== undefined) patch[column] = value;
  }
  if (Object.keys(patch).length === 0) {
    return getChild(childId);
  }
  const { data, error } = await supabase
    .from('children')
    .update(patch)
    .eq('id', childId)
    .select('id, first_name, last_name, nickname, slug, school_name, district, grade_level, timezone, avatar_url')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Remove a child = SOFT DELETE (status -> 'archived'). The hard DELETE grant
 * exists but archiving preserves the grade/assignment/message history and is
 * reversible. Archived children are excluded from listMyChildren.
 */
export async function archiveChild(childId: string): Promise<{ id: string; status: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('children')
    .update({ status: 'archived' })
    .eq('id', childId)
    .select('id, status')
    .single();
  if (error) throw error;
  return data as { id: string; status: string };
}
