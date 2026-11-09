import { type NextRequest, NextResponse } from "next/server";
import { authEnabled, supabaseServer } from "@/lib/auth";

// Where sign-in links land. Supabase adds a one-time code, which is swapped
// for a session cookie. It must open in the browser that asked for the link.
export const GET = async (request: NextRequest) => {
  const code = request.nextUrl.searchParams.get("code");
  if (authEnabled && code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
};
