"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Suggestion = {
  _id: string;
  id: number;
  name: string;
  lineage_first_name: string | null;
};

export function HomeSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSuggestions(q);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [q]);

  async function loadSuggestions(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setSuggesting(false);
      return;
    }

    const currentId = requestIdRef.current + 1;
    requestIdRef.current = currentId;
    setSuggesting(true);
    try {
      const res = await fetch(`/api/search?suggest=true&limit=8&q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (requestIdRef.current !== currentId) return;
      setSuggestions(data.suggestions ?? []);
    } finally {
      if (requestIdRef.current === currentId) setSuggesting(false);
    }
  }

  function goToSearch(value: string) {
    router.push(`/search?q=${encodeURIComponent(value.trim())}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    goToSearch(q);
    setIsFocused(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-7">
      <div className="relative z-30">
        <div className="search-glow-shell home-search-shell rounded-3xl border border-cyan-200/80 bg-white/85 p-4 shadow-[0_18px_40px_rgba(14,116,144,0.14)] backdrop-blur sm:flex sm:items-center sm:gap-3 sm:rounded-2xl sm:p-3 sm:shadow-none">
          <label className="mb-2 block text-[11px] font-semibold tracking-[0.16em] text-cyan-700 uppercase sm:hidden">
            Search Lineage
          </label>
          <div className="relative flex-1">
            <svg
              aria-hidden
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-700/70"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 120)}
              placeholder="Try: Osman Mahamud Saleiban Mahamed"
              className="h-14 w-full rounded-2xl border border-cyan-100 bg-white px-12 text-lg font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 sm:h-12 sm:rounded-xl sm:px-11 sm:text-base sm:font-normal"
            />
          </div>
          <button
            type="submit"
            className="mt-3 h-14 w-full rounded-2xl bg-gradient-to-r from-cyan-700 to-sky-700 px-6 text-base font-semibold tracking-wide text-white shadow-[0_8px_20px_rgba(8,145,178,0.35)] transition hover:from-cyan-800 hover:to-sky-800 sm:mt-0 sm:h-12 sm:w-auto sm:rounded-xl sm:px-5 sm:text-sm sm:shadow-none"
          >
            Search Lineage
          </button>
        </div>

        {isFocused && (suggestions.length > 0 || suggesting) ? (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            {suggestions.map((person) => (
              <button
                key={person._id}
                type="button"
                className="flex w-full items-start justify-between border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 sm:px-4 sm:py-3"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQ(person.name);
                  goToSearch(person.name);
                  setIsFocused(false);
                }}
              >
                <span className="text-base font-semibold text-slate-900 sm:text-sm sm:font-medium">{person.name}</span>
                <span className="ml-4 text-xs text-slate-500">{person.lineage_first_name ?? "Unknown lineage"}</span>
              </button>
            ))}
            {suggesting ? <p className="px-4 py-3 text-sm text-slate-500">Looking up similar names...</p> : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
