import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Keeps the admin signed in. Supabase sessions expire after an hour, and this
// renews them before each page loads. Visitors without a Supabase cookie,
// which is everyone but the admin, pass straight through.
export const proxy = async (request: NextRequest) => {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const hasSession = request.cookies.getAll().some(({ name }) => name.startsWith("sb-"));
  if (!url || !key || !hasSession) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Pass renewed cookies on to the page and back to the browser
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  await supabase.auth.getUser();
  return response;
};

export const config = {
  // Pages only, not images, fonts or Next.js's own files
  matcher: ["/((?!_next/static|_next/image|icon.svg|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
