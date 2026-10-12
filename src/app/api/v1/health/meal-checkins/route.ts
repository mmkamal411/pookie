// /api/v1/health/meal-checkins — W23 descriptive meal check-ins (sol-health §6.2).
//
// POST: log a meal check-in (no numbers by schema — there are no calorie,
//   macro, or weight columns on meal_checkins; a minor cannot log what the
//   schema cannot hold).
// GET: list check-ins for a subject (tier-filtered by RLS; parents of <18
//   see engagement only via nutrition_weekly_patterns(), not these rows,
//   unless the teen's H2 grant covers them).
//
// Weight-neutral framing is a copy rule enforced in the client; the API
// never accepts or returns calorie/macro/weight-loss fields on this route.
//
// Auth/cookies: delegated to handleRoute → createClient() (commit 538f288).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema, toHealthApiError } from '../_lib';

const checkinSchema = z.object({
  subject_id: uuidSchema,
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  food_groups: z.array(z.string().max(40)).max(12).default([]),
  hunger_before: z.number().int().min(1).max(5).optional(),
  fullness_after: z.number().int().min(1).max(5).optional(),
  energy_note: z.string().max(500).optional(),
  logged_at: z.string().datetime().optional(),
});

const querySchema = z.object({
  subject_id: uuidSchema,
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime().optional(),
});

export const GET = handleRoute(async ({ requestId }, req) => {
  const { searchParams } = new URL(req.url);
  const q = querySchema.parse({
    subject_id: searchParams.get('subject_id'),
    limit: searchParams.get('limit') ?? undefined,
    before: searchParams.get('before') ?? undefined,
  });
  await assertHealthSubject(q.subject_id);
  const supabase = await createClient();
  try {
    let query = supabase
      .from('meal_checkins')
      .select(
        'id, logged_at, meal, food_groups, hunger_before, fullness_after, energy_note, health_tier',
      )
      .eq('subject_id', q.subject_id)
      .order('logged_at', { ascending: false })
      .limit(q.limit);
    if (q.before) query = query.lt('logged_at', q.before);
    const { data, error } = await query;
    if (error) throw error;
    return { checkins: data ?? [] };
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});

export const POST = handleRoute(async ({ requestId, userId }, req) => {
  const body = checkinSchema.parse(await req.json());
  const subject = await assertHealthSubject(body.subject_id);
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('meal_checkins')
      .insert({
        subject_id: body.subject_id,
        meal: body.meal,
        food_groups: body.food_groups,
        hunger_before: body.hunger_before ?? null,
        fullness_after: body.fullness_after ?? null,
        energy_note: body.energy_note ?? null,
        logged_at: body.logged_at ?? new Date().toISOString(),
        logged_by: userId,
        health_tier: 'H2',
      })
      .select('id, logged_at, meal')
      .single();
    if (error) throw error;
    await auditEvent(subject.subjectChildId!, 'health.meal_checkin_logged', {
      meal: body.meal,
    });
    return { checkin: data };
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});
