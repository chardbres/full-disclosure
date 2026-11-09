import Link from "next/link";

const NotFound = () => {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-serif text-3xl font-semibold text-ink">Page not found</h1>
      <p className="mt-3 text-ink-2">
        There&rsquo;s nothing at this address. Check the ticker or link, or
        search for a company from the filings page.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
      >
        Browse all filings
      </Link>
    </div>
  );
};

export default NotFound;
