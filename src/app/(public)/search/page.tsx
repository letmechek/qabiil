"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type SearchResult = {
  _id: string;
  id: number;
  name: string;
  lineage_first_name: string | null;
};

export default function SearchPage() {
  const initialQuery = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("q") ?? "";
  }, []);

  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  async function loadResults(query: string) {
    setLoading(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setSuggestions(data.suggestions ?? []);
    setDidYouMean(data.didYouMean ?? null);
    setLoading(false);
  }

  async function loadSuggestions(query: string) {
    const res = await fetch(`/api/search?suggest=true&limit=8&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setSuggestions(data.suggestions ?? []);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadResults(initialQuery);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialQuery]);

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

            {isFocused && suggestions.length > 0 ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                {suggestions.map((person) => (
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
              </div>
            ) : null}
          </div>
        </form>
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
      </section>

      <section className="mt-4 grid gap-3">
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
