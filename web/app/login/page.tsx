import type { Metadata } from "next";
import { Suspense } from "react";
import { authEnabled, getAdmin } from "@/lib/auth";
import { sendSignInLink, signOut } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

const MESSAGES: Record<string, string> = {
  email: "Enter a valid email address.",
  link: "That sign-in link didn't work. Links expire after an hour and must open in the browser that asked for them. Request a new one.",
  off: "Sign-in isn't set up on this site.",
  rate: "Too many sign-in emails just now. Wait a few minutes and try again.",
};

const LoginPage = ({ searchParams }: PageProps<"/login">) => {
  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="font-serif text-3xl font-semibold text-ink">Sign in</h1>
      <Suspense fallback={<p className="mt-4 text-muted">Loading…</p>}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
};

export default LoginPage;

const LoginForm = async ({ searchParams }: Pick<PageProps<"/login">, "searchParams">) => {
  const { sent, error } = await searchParams;
  const admin = await getAdmin();

  if (admin) {
    return (
      <div className="mt-4 space-y-4 text-ink-2">
        <p>You&rsquo;re signed in as {admin.email}.</p>
        <form action={signOut}>
          <button type="submit" className="h-10 rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-paper">
            Sign out
          </button>
        </form>
      </div>
    );
  }

  if (sent) {
    return (
      <p className="mt-4 rounded-lg border border-line bg-surface p-4 text-ink-2" role="status">
        If that address has an account, a sign-in link is on its way. Open it
        in this browser.
      </p>
    );
  }

  const message = !authEnabled
    ? MESSAGES.off
    : typeof error === "string"
      ? MESSAGES[error]
      : undefined;
  return (
    <form action={sendSignInLink} className="mt-6 space-y-4">
      {message && (
        <p className="rounded-md border border-negative/30 bg-negative-soft p-3 text-sm text-negative" role="alert">
          {message}
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={!authEnabled}
          className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-ink focus:border-brand focus:outline-2 focus:outline-brand/20 disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={!authEnabled}
        className="h-10 w-full rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
      >
        Email me a sign-in link
      </button>
    </form>
  );
};
