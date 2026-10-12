import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  authFailureCode,
  safePostAuthNext,
} from "@/lib/auth/callback-helpers";

/**
 * OAuth / OTP callback. Supabase redirects here after the user
 * authenticates; we exchange the code for a session and hand off
 * to / for tenant resolution.
 *
 * Edge-safe cookie handling: session cookies set during the code
 * exchange are captured in a local array and explicitly attached to
 * the redirect response. We do NOT rely on next/headers cookies().set()
 * propagation to a freshly-created NextResponse — that propagation is
 * framework magic that is unreliable on Cloudflare Workers (OpenNext).
 * Reading the incoming cookies comes straight from the request.
 *
 * ?next= is re-validated here (safePostAuthNext) even though /login
 * validates it too — the callback must never trust a query param
 * blindly, or a crafted link could bounce a fresh session off-site.
 * Exchange failures map to specific ?error= codes so /login can show
 * a targeted recovery hint (expired link vs blocked cookies) instead
 * of one generic "try again".
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safePostAuthNext(searchParams.get("next"));

  if (code) {
    // Collect every Set-Cookie the Supabase client wants to write so we
    // can attach them to the redirect response explicitly.
    const pendingCookies: { name: string; value: string; options?: object }[] =
      [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
      }
      return response;
    }
    return NextResponse.redirect(
      `${origin}/login?error=${authFailureCode(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
