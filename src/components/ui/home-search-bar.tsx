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
        <div className="search-glow-shell flex flex-col gap-3 rounded-2xl border border-cyan-200/80 bg-white/80 p-3 backdrop-blur sm:flex-row sm:items-center">
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 120)}
            placeholder="Try: Osman Mahamud Saleiban Mahamed"
            className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />
          <button
            type="submit"
            className="h-12 rounded-xl bg-cyan-700 px-5 text-sm font-semibold tracking-wide text-white transition hover:bg-cyan-800"
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
                className="flex w-full items-start justify-between border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQ(person.name);
                  goToSearch(person.name);
                  setIsFocused(false);
                }}
              >
                <span className="font-medium text-slate-900">{person.name}</span>
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
