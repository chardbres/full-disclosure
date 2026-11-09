import Link from "next/link";

const GITHUB_URL = "https://github.com/chardbres/full-disclosure";

const SiteHeader = () => {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-md bg-brand font-serif text-sm font-semibold text-white"
          >
            FD
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight whitespace-nowrap text-brand sm:text-xl">
            Full Disclosure
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm font-medium text-ink-2 sm:gap-5">
          <Link href="/" className="hover:text-ink">
            Filings
          </Link>
          <Link href="/about" className="hover:text-ink">
            About
          </Link>
          <a href={GITHUB_URL} className="hover:text-ink">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;
