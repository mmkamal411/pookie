// Framework-free business logic for /api/v1/me and /api/v1/me/notifications.
// Handlers (REST) are thin adapters: validate → resolve household → call
// service → shape response. No framework imports here.
//
// Profile reads/writes the public.users row (1:1 with auth.users). RLS:
//   users_self_read   — own row (parents also see household members)
//   users_self_update — own row; column GRANT restricts to display_name only.
//
// Notification prefs have no user-level table yet (SQL workstream owns that
// DDL). Until then prefs live in child_settings.notifications for the
// caller's anchor child (default child for parents, own child for teens).
// The stored shape is a partial of NotificationPrefs; reads merge over
// DEFAULT_PREFS so new keys get sane values without a backfill.
import { createClient } from '@/lib/supabase/server';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export interface NotificationPrefs {
  sync_complete: boolean;
  grade_drop: boolean;
  due_soon: boolean;
  weekly_digest: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  sync_complete: true,
  grade_drop: true,
  due_soon: true,
  weekly_digest: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
};

interface UsersRow {
  id: string;
  email: string;
  display_name: string | null;
}

function toProfile(row: UsersRow): Profile {
  return {
    id: row.id,
    email: row.email,
    name: row.display_name,
    // No avatar_url column on public.users (DDL owned by SQL workstream).
    avatar_url: null,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toProfile(data as UsersRow);
}

export async function updateProfile(
  userId: string,
  patch: { name?: string | null },
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .update({ display_name: patch.name ?? null })
    .eq('id', userId)
    .select('id, email, display_name')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toProfile(data as UsersRow);
}

/**
 * Read notification prefs for the anchor child, merged over defaults.
 * Missing child_settings row (or missing keys) → defaults fill the gaps.
 */
export async function getNotificationPrefs(anchorChildId: string): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('child_settings')
    .select('notifications')
    .eq('child_id', anchorChildId)
    .maybeSingle();
  if (error) throw error;
  const stored = ((data as { notifications: Partial<NotificationPrefs> } | null)?.notifications ?? {}) as Partial<NotificationPrefs>;
  return { ...DEFAULT_PREFS, ...stored };
}

/**
 * Merge-patch notification prefs onto the anchor child's child_settings row
 * (upsert — the row may not exist yet for new children).
 */
export async function updateNotificationPrefs(
  anchorChildId: string,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const current = await getNotificationPrefs(anchorChildId);
  const merged: NotificationPrefs = { ...current, ...patch };
  const { error } = await supabase.from('child_settings').upsert(
    { child_id: anchorChildId, notifications: merged },
    { onConflict: 'child_id' },
  );
  if (error) throw error;
  return merged;
}
