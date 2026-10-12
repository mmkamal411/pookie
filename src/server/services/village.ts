// Squad Village — the village around each child ("the crew").
//
// Parents grant trusted people a mentor view of a child's school life.
// Age-tiered consent (founder-locked):
//   under 13 .... parent grants; active immediately (consent not_required)
//   13–15 ....... child consent required; 7-day cooling-off after grant
//   16+ ......... child consent required; active immediately on grant
// Mentors VIEW + ENCOURAGE only. Instant removal anytime. Every view logged.
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';

type Db = Awaited<ReturnType<typeof createClient>>;

export const grantMentorSchema = z.object({
  child_id: z.string().uuid(),
  mentor_email: z.string().email().max(320),
  relationship: z.enum(['sibling', 'uncle', 'aunt', 'grandparent', 'tutor', 'coach', 'other']),
  scope_class_ids: z.array(z.string().uuid()).nullable().optional(),
});

export const mentorConsentSchema = z.object({
  mentor_id: z.string().uuid(),
  consent: z.enum(['granted', 'denied']),
});

export interface Mentor {
  id: string;
  child_id: string;
  mentor_user_id: string;
  mentor_email: string | null;
  mentor_name: string | null;
  relationship: string;
  scope_class_ids: string[] | null;
  status: string;
  child_consent: string;
  created_at: string;
}

function ageOn(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** True when the caller is a parent on the child's tenant. */
async function assertParentOf(supabase: Db, userId: string, childId: string): Promise<void> {
  const { data } = await supabase
    .from('child_access')
    .select('role')
    .eq('child_id', childId)
    .eq('user_id', userId)
    .single();
  if ((data as { role: string } | null)?.role !== 'parent') {
    failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  }
}

/** True when the caller is the child user of this child tenant. */
async function assertChildSelf(supabase: Db, userId: string, childId: string): Promise<void> {
  const { data } = await supabase
    .from('child_access')
    .select('role')
    .eq('child_id', childId)
    .eq('user_id', userId)
    .single();
  if ((data as { role: string } | null)?.role !== 'child') {
    failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  }
}

async function lookupUserByEmail(supabase: Db, email: string) {
  const { data } = await supabase
    .from('users')
    .select('id, email, display_name')
    .ilike('email', email.trim())
    .single();
  return (data as { id: string; email: string; display_name: string | null } | null) ?? null;
}

function toMentor(
  row: Record<string, unknown>,
  directory: Map<string, { email: string; display_name: string | null }>,
): Mentor {
  const dir = directory.get(row.mentor_user_id as string);
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    mentor_user_id: row.mentor_user_id as string,
    mentor_email: dir?.email ?? null,
    mentor_name: dir?.display_name ?? null,
    relationship: row.relationship as string,
    scope_class_ids: (row.scope_class_ids as string[] | null) ?? null,
    status: row.status as string,
    child_consent: row.child_consent as string,
    created_at: row.created_at as string,
  };
}

async function hydrateDirectory(
  supabase: Db,
  rows: Record<string, unknown>[],
): Promise<Map<string, { email: string; display_name: string | null }>> {
  const ids = [...new Set(rows.map((r) => r.mentor_user_id as string))];
  const map = new Map<string, { email: string; display_name: string | null }>();
  if (!ids.length) return map;
  const { data } = await supabase.from('users').select('id, email, display_name').in('id', ids);
  for (const u of (data ?? []) as { id: string; email: string; display_name: string | null }[]) {
    map.set(u.id, { email: u.email, display_name: u.display_name });
  }
  return map;
}

/** Parent grants a mentor. Applies the age-tiered consent rules. */
export async function grantMentor(
  userId: string,
  input: z.infer<typeof grantMentorSchema>,
): Promise<{ mentor_id: string; status: string; child_consent: string }> {
  const supabase = await createClient();
  await assertParentOf(supabase, userId, input.child_id);

  const mentor = await lookupUserByEmail(supabase, input.mentor_email);
  if (!mentor) failWith(ErrorCodes.NOT_FOUND);
  if (mentor.id === userId) failWith(ErrorCodes.CONFLICT);

  const { data: child } = await supabase
    .from('children')
    .select('date_of_birth')
    .eq('id', input.child_id)
    .single();
  const age = ageOn((child as { date_of_birth: string | null } | null)?.date_of_birth ?? null);

  // Age-tiered consent.
  let status = 'pending';
  let child_consent = 'pending';
  let cooling_off_until: string | null = null;
  if (age === null || age < 13) {
    status = 'active';
    child_consent = 'not_required';
  } else if (age >= 16) {
    status = 'pending'; // waits for the teen's consent, then instant
    child_consent = 'pending';
  } else {
    status = 'cooling_off'; // 13–15: consent + 7-day cooling-off
    child_consent = 'pending';
    cooling_off_until = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  }

  const { data, error } = await supabase
    .from('child_mentors')
    .upsert(
      {
        child_id: input.child_id,
        mentor_user_id: mentor.id,
        granted_by_user_id: userId,
        relationship: input.relationship,
        scope_class_ids: input.scope_class_ids ?? null,
        status,
        child_consent,
        cooling_off_until,
      },
      { onConflict: 'child_id,mentor_user_id' },
    )
    .select('id, status, child_consent')
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  const row = data as { id: string; status: string; child_consent: string };
  return { mentor_id: row.id, status: row.status, child_consent: row.child_consent };
}

/** The child (13+) grants or denies consent on a pending mentor grant. */
export async function answerMentorConsent(
  userId: string,
  input: z.infer<typeof mentorConsentSchema>,
): Promise<{ status: string }> {
  const supabase = await createClient();
  const { data: mentor } = await supabase
    .from('child_mentors')
    .select('id, child_id, status, child_consent')
    .eq('id', input.mentor_id)
    .single();
  const row = mentor as {
    id: string;
    child_id: string;
    status: string;
    child_consent: string;
  } | null;
  if (!row) failWith(ErrorCodes.NOT_FOUND);
  await assertChildSelf(supabase, userId, row.child_id);

  const { data: child } = await supabase
    .from('children')
    .select('date_of_birth')
    .eq('id', row.child_id)
    .single();
  const age = ageOn((child as { date_of_birth: string | null } | null)?.date_of_birth ?? null);

  if (input.consent === 'denied') {
    await supabase
      .from('child_mentors')
      .update({ status: 'revoked', child_consent: 'denied' })
      .eq('id', row.id);
    return { status: 'revoked' };
  }

  // Granted: 13–15 keeps the 7-day cooling-off; 16+ activates instantly.
  const patch: Record<string, unknown> = {
    child_consent: 'granted',
    consent_granted_at: new Date().toISOString(),
  };
  if (age !== null && age >= 13 && age < 16) {
    patch.status = 'cooling_off';
    patch.cooling_off_until = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  } else {
    patch.status = 'active';
    patch.cooling_off_until = null;
  }
  await supabase.from('child_mentors').update(patch).eq('id', row.id);
  return { status: patch.status as string };
}

/** Parent revokes a mentor — instant, no questions. */
export async function revokeMentor(userId: string, mentorId: string): Promise<void> {
  const supabase = await createClient();
  const { data: mentor } = await supabase
    .from('child_mentors')
    .select('child_id')
    .eq('id', mentorId)
    .single();
  const row = mentor as { child_id: string } | null;
  if (!row) failWith(ErrorCodes.NOT_FOUND);
  await assertParentOf(supabase, userId, row.child_id);
  await supabase.from('child_mentors').update({ status: 'revoked' }).eq('id', mentorId);
}

/** Mentors for a child — visible to tenant parents and the child. */
export async function listMentors(userId: string, childId: string): Promise<Mentor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('child_mentors')
    .select('id, child_id, mentor_user_id, relationship, scope_class_ids, status, child_consent, created_at')
    .eq('child_id', childId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];
  // RLS enforces tenant-parent / mentor-self / child-self visibility.
  const directory = await hydrateDirectory(supabase, rows);
  return rows.map((r) => toMentor(r, directory));
}

/** Children the caller actively mentors — the mentor's ship roster. */
export async function myMentorships(userId: string): Promise<
  { child_id: string; first_name: string; nickname: string | null; relationship: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('child_mentors')
    .select('child_id, relationship')
    .eq('mentor_user_id', userId)
    .in('status', ['active', 'cooling_off']);
  const rows = (data ?? []) as { child_id: string; relationship: string }[];
  if (!rows.length) return [];
  const { data: children } = await supabase
    .from('children')
    .select('id, first_name, nickname')
    .in('id', rows.map((r) => r.child_id));
  const cmap = new Map(
    ((children ?? []) as { id: string; first_name: string; nickname: string | null }[]).map(
      (c) => [c.id, c],
    ),
  );
  return rows.map((r) => ({
    child_id: r.child_id,
    first_name: cmap.get(r.child_id)?.first_name ?? 'A student',
    nickname: cmap.get(r.child_id)?.nickname ?? null,
    relationship: r.relationship,
  }));
}

/** Mentor's scoped school view: classes + current grades + upcoming/missing work. */
export async function mentorOverview(userId: string, childId: string) {
  const supabase = await createClient();
  // Must hold an active mentor grant (RLS on the school tables enforces scope).
  const { data: grant } = await supabase
    .from('child_mentors')
    .select('id, scope_class_ids, relationship')
    .eq('child_id', childId)
    .eq('mentor_user_id', userId)
    .single();
  const g = grant as { id: string; scope_class_ids: string[] | null; relationship: string } | null;
  if (!g) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  const { data: child } = await supabase
    .from('children')
    .select('first_name, nickname')
    .eq('id', childId)
    .single();

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, teacher_name, period')
    .eq('child_id', childId);
  const { data: grades } = await supabase
    .from('grades')
    .select('class_id, term, numeric')
    .eq('child_id', childId)
    .order('term', { ascending: false });
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, class_id, title, due_date, status')
    .eq('child_id', childId)
    .in('status', ['upcoming', 'missing', 'late'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(30);

  // Log the view (audit trail).
  await supabase.from('mentor_access_log').insert({
    mentor_id: g.id,
    child_id: childId,
    action: 'overview.viewed',
  });

  return {
    child: child as { first_name: string; nickname: string | null } | null,
    relationship: g.relationship,
    classes: (classes ?? []) as { id: string; name: string; teacher_name: string | null; period: string | null }[],
    grades: (grades ?? []) as { class_id: string; term: string; numeric: number | null }[],
    assignments: (assignments ?? []) as {
      id: string;
      class_id: string;
      title: string;
      due_date: string | null;
      status: string;
    }[],
  };
}

/** Mentor sends encouragement. */
export async function sendKudos(
  userId: string,
  input: { child_id: string; message: string },
): Promise<{ kudos_id: string }> {
  const supabase = await createClient();
  const { data: grant } = await supabase
    .from('child_mentors')
    .select('id')
    .eq('child_id', input.child_id)
    .eq('mentor_user_id', userId)
    .single();
  const g = grant as { id: string } | null;
  if (!g) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  const { data, error } = await supabase
    .from('mentor_kudos')
    .insert({ mentor_id: g.id, child_id: input.child_id, message: input.message.slice(0, 500) })
    .select('id')
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return { kudos_id: (data as { id: string }).id };
}

/** Kudos for a child — visible to the tenant (child + parents) and the mentor. */
export async function listKudos(childId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('mentor_kudos')
    .select('id, message, created_at, mentor_id')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = (data ?? []) as { id: string; message: string; created_at: string; mentor_id: string }[];
  const { data: mentors } = await supabase
    .from('child_mentors')
    .select('id, mentor_user_id, relationship')
    .in('id', rows.map((r) => r.mentor_id));
  const mmap = new Map(
    ((mentors ?? []) as { id: string; mentor_user_id: string; relationship: string }[]).map((m) => [
      m.id,
      m,
    ]),
  );
  const directory = await hydrateDirectory(
    supabase,
    rows.map((r) => ({ mentor_user_id: mmap.get(r.mentor_id)?.mentor_user_id ?? '' })),
  );
  return rows.map((r) => {
    const m = mmap.get(r.mentor_id);
    const dir = m ? directory.get(m.mentor_user_id) : undefined;
    return {
      id: r.id,
      message: r.message,
      created_at: r.created_at,
      from_name: dir?.display_name ?? dir?.email ?? 'A mentor',
      relationship: m?.relationship ?? null,
    };
  });
}
