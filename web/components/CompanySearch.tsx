"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

interface Suggestion {
  ticker: string;
  name: string;
}

// The dashboard's search box. Typing filters the table (through onChange)
// and suggests companies from the SEC's list. Choosing one, or pressing Enter
// on an exact ticker, opens that company's page.
const CompanySearch = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const router = useRouter();
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Ask for suggestions once typing pauses, and drop answers for older text
  useEffect(() => {
    const query = value.trim();
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/companies?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          setSuggestions(await response.json());
          setActive(-1);
        }
      } catch {
        // Cancelled by newer typing, or offline. Keep the last suggestions.
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const shown = open && value.trim() ? suggestions : [];

  const go = (ticker: string) => {
    setOpen(false);
    router.push(`/companies/${ticker}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (!shown.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + shown.length) % shown.length);
    } else if (event.key === "Enter") {
      const exact = shown.find((s) => s.ticker === value.trim().toUpperCase());
      const choice = shown[active] ?? exact;
      if (choice) {
        event.preventDefault();
        go(choice.ticker);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full sm:w-64">
      <label className="sr-only" htmlFor="filing-search">
        Search by ticker or company
      </label>
      <input
        id="filing-search"
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={shown.length > 0}
        aria-controls={listId}
        aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Search ticker or company"
        className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-2 focus:outline-brand/20"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Companies"
        hidden={!shown.length}
        className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg"
      >
        {shown.map((suggestion, index) => (
          <li
            key={suggestion.ticker}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // Mouse down, not click, so it fires before the input loses focus
            onMouseDown={(event) => {
              event.preventDefault();
              go(suggestion.ticker);
            }}
            onMouseEnter={() => setActive(index)}
            className="flex cursor-pointer items-baseline gap-3 px-3 py-2 text-sm aria-selected:bg-paper"
          >
            <span className="w-14 shrink-0 font-semibold text-ink">{suggestion.ticker}</span>
            <span className="truncate text-ink-2">{suggestion.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CompanySearch;
