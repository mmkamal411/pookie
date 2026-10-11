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
