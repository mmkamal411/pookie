import { createClient } from "@/lib/supabase/server";
import { previewFamilyInvite } from "@/server/services/family-links";
import { AcceptFlow } from "./accept-flow";

export const dynamic = "force-dynamic";

/**
 * /family/invite/accept?token= — Parent B redeems the invite (FR-AUTH-011).
 *
 * Public page: the preview shows zero child PII before authentication
 * (FR-AUTH-009) — only the inviter's name. Accepting requires sign-in.
 * Invalid/expired/used tokens all read the same.
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let preview: { inviter_name: string | null; expires_at: string } | null = null;
  let previewError = false;
  if (token) {
    try {
      preview = await previewFamilyInvite(token);
    } catch {
      previewError = true;
    }
  } else {
    previewError = true;
  }

  return (
    <AcceptFlow
      token={token ?? null}
      preview={preview}
      previewError={previewError}
      signedIn={!!user}
    />
  );
}
