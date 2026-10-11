import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OTP / magic-link callback. Supabase redirects here after the user
 * clicks the email link; we exchange the code for a session and
 * hand off to / for tenant resolution.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
