import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Whether sign-in is set up. Without these settings the site runs as a public,
// read-only site, and no one counts as the admin.
export const authEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY && process.env.ADMIN_EMAIL);

// A Supabase client that keeps the session in this request's cookies
export const supabaseServer = async () => {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Pages can't set cookies while rendering. proxy.ts refreshes the
          // session on the next request instead.
        }
      },
    },
  });
};

// The signed-in user if it's the admin, otherwise null. Supabase checks the
// session with its server, so a forged cookie doesn't pass. The email check
// means a second account, if one were ever created, still isn't the admin.
export const getAdmin = async (): Promise<User | null> => {
  if (!authEnabled) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  return email && email === process.env.ADMIN_EMAIL!.trim().toLowerCase() ? data.user : null;
};
