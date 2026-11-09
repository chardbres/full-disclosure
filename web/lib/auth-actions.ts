"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authEnabled, supabaseServer } from "./auth";

// Emails a sign-in link. It only goes to existing accounts, and the page says
// the same thing either way, so it can't be used to check who has one.
export const sendSignInLink = async (formData: FormData) => {
  const email = String(formData.get("email") ?? "").trim();
  if (!authEnabled) redirect("/login?error=off");
  if (!email.includes("@")) redirect("/login?error=email");

  const origin =
    (await headers()).get("origin") ?? "https://fulldisclosure.rickbresnahan.com";
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  // Supabase's built-in email allows only a few sends an hour
  if (error?.status === 429) redirect("/login?error=rate");
  redirect("/login?sent=1");
};

export const signOut = async () => {
  if (authEnabled) await (await supabaseServer()).auth.signOut();
  redirect("/");
};
