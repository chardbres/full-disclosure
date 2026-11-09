const SiteFooter = () => {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
        <p className="max-w-xl">
          Summaries are written by Claude from public filings on SEC EDGAR and
          can contain mistakes. Check the original filing before relying on
          them. Not investment advice.
        </p>
        <p>
          Built by{" "}
          <a href="https://www.rickbresnahan.com" className="underline hover:text-ink">
            Rick Bresnahan
          </a>
        </p>
      </div>
    </footer>
  );
};

export default SiteFooter;
