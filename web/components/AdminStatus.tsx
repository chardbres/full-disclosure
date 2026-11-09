import { getAdmin } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";

// A thin bar above the header, shown only to the signed-in admin. It reads
// the session cookie, so it sits in its own Suspense boundary and the rest of
// each page can still be built ahead of time.
const AdminStatus = async () => {
  const admin = await getAdmin();
  if (!admin) return null;
  return (
    <div className="bg-brand text-xs text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-1.5 sm:px-6">
        <span className="truncate">Signed in as {admin.email}</span>
        <form action={signOut}>
          <button type="submit" className="font-medium whitespace-nowrap underline underline-offset-2 hover:no-underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminStatus;
