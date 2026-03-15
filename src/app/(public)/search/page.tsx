"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type SearchResult = {
  _id: string;
  id: number;
  name: string;
  lineage_first_name: string | null;
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [resultSuggestions, setResultSuggestions] = useState<SearchResult[]>([]);
  const [dropdownSuggestions, setDropdownSuggestions] = useState<SearchResult[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const suggestionRequestId = useRef(0);

  async function loadResults(query: string) {
    setLoading(true);
    setError(null);
    setLastQuery(query);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setResultSuggestions(data.suggestions ?? []);
      setDidYouMean(data.didYouMean ?? null);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSuggestions(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      setDropdownSuggestions([]);
      setSuggesting(false);
      return;
    }

    const currentId = suggestionRequestId.current + 1;
    suggestionRequestId.current = currentId;
    setSuggesting(true);
    try {
      const res = await fetch(`/api/search?suggest=true&limit=8&q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (suggestionRequestId.current !== currentId) return;
      setDropdownSuggestions(data.suggestions ?? []);
    } finally {
      if (suggestionRequestId.current === currentId) setSuggesting(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") ?? "";
    setQ(initialQuery);
    void loadResults(initialQuery);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSuggestions(q);
    }, 180);

    return () => clearTimeout(timer);
  }, [q]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    void loadResults(q);
    setIsFocused(false);
  }

  return (
    <main className="container-shell py-6">
      <section className="card p-5">
        <h1 className="text-2xl font-bold">Search people</h1>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div className="relative">
            <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm ring-4 ring-cyan-50 focus-within:border-cyan-400 focus-within:ring-cyan-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5 text-slate-500"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setTimeout(() => setIsFocused(false), 120);
                }}
                placeholder="Search by lineage names. Example: Ismaeil Saleiban Mahamed"
                className="h-12 w-full bg-transparent px-3 text-base outline-none"
              />
              <button className="btn-primary px-5 py-2.5" type="submit" disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
            </div>

            {isFocused && (dropdownSuggestions.length > 0 || suggesting) ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                {dropdownSuggestions.map((person) => (
                  <button
                    key={person._id}
                    type="button"
                    className="flex w-full items-start justify-between border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setQ(person.name);
                      void loadResults(person.name);
                      setIsFocused(false);
                    }}
                  >
                    <span className="font-medium text-slate-900">{person.name}</span>
                    <span className="ml-4 text-xs text-slate-500">
                      {person.lineage_first_name ?? "Unknown lineage"}
                    </span>
                  </button>
                ))}
                {suggesting ? (
                  <p className="px-4 py-3 text-sm text-slate-500">Looking up similar names...</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </form>
          <div className="mt-3">
          {loading ? (
            <p className="text-sm font-medium text-cyan-700">
              Searching for &quot;{q || "all people"}&quot;...
            </p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : lastQuery.trim() ? (
            <p className="text-sm text-slate-600">
              Found <span className="font-semibold">{results.length}</span> result{results.length === 1 ? "" : "s"} for{" "}
              <span className="font-semibold">&quot;{lastQuery.trim()}&quot;</span>.
            </p>
          ) : (
            <p className="text-sm text-slate-500">Type a name or lineage and press search.</p>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-3">
        {!loading && !error && lastQuery.trim() && results.length === 0 ? (
          <article className="card p-5">
            <h2 className="text-lg font-semibold">No results found</h2>
            <p className="mt-1 text-sm text-slate-600">Try a different spelling or a shorter lineage chain.</p>
            {didYouMean ? (
              <p className="mt-3 text-sm text-slate-600">
                Did you mean{" "}
                <button
                  type="button"
                  className="font-semibold text-cyan-700 underline"
                  onClick={() => {
                    setQ(didYouMean);
                    void loadResults(didYouMean);
                  }}
                >
                  {didYouMean}
                </button>
                ?
              </p>
            ) : null}
            {resultSuggestions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {resultSuggestions.slice(0, 6).map((person) => (
                  <button
                    key={person._id}
                    type="button"
                    className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setQ(person.name);
                      void loadResults(person.name);
                    }}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}

        {results.map((person) => (
          <Link key={person._id} className="card p-4" href={`/p/${person.id}`}>
            <p className="font-semibold">{person.name}</p>
            <p className="text-sm text-slate-500">
              Lineage starts with: {person.lineage_first_name ?? "Unknown"}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
