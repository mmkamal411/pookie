// GET /api/v1/health/subjects — household health roster.
// POST /api/v1/health/subjects — parent-only: register a person.
// Every route: handleRoute → assert → use → auditEvent(anchor child).
import { handleRoute, auditEvent } from '@/server/rest';
import {
  createSubject,
  createSubjectSchema,
  listSubjects,
} from '@/server/services/health';

export const GET = handleRoute(async () => {
  const { household, subjects } = await listSubjects();
  return {
    subjects: subjects.map((s) => ({
      subject_id: s.id,
      label: s.label,
      subject_kind: s.subject_kind,
      age_band: s.age_band,
    })),
    role: household.role,
  };
});

export const POST = handleRoute(async (ctx, req) => {
  const body = createSubjectSchema.parse(await req.json());
  const subject = await createSubject(body);
  // Anchor the audit to the subject's child tenant (audit_event needs child_id).
  await auditEvent(subject.child_id, 'health_subject.created', {
    subject_id: subject.id,
  });
  // Keep the response shaped like the roster; the detail route serves more.
  return {
    subject: {
      subject_id: subject.id,
      label: subject.label,
      subject_kind: subject.subject_kind,
      age_band: subject.age_band,
    },
  };
});
