import Link from "next/link";

import { searchPeople } from "@/lib/services/search.service";

export const dynamic = "force-dynamic";

const MAJOR_QABILS = [
  {
    name: "Darod",
    summary: "Explore major Darod branches and descendants.",
  },
  {
    name: "Hawiye",
    summary: "Start from Hawiye roots and move across family lines.",
  },
  {
    name: "Dir",
    summary: "Browse Dir lineage paths and linked households.",
  },
  {
    name: "Rahanweyn",
    summary: "Trace Rahanweyn lineages and related sub-clans.",
  },
] as const;

export default async function HomePage() {
  const featured = await searchPeople("", 6).catch(() => []);
  const majorStarts = await Promise.all(
    MAJOR_QABILS.map(async (qabil) => {
      const result = await searchPeople(qabil.name, 1).catch(() => []);
      const first = result[0];
      return {
        ...qabil,
        href: first ? `/p/${first.id}` : `/search?q=${encodeURIComponent(qabil.name)}`,
        cta: first ? "Start from profile" : "Search this qabil",
      };
    }),
  );

  return (
    <main className="container-shell space-y-6 py-6">
      <section className="card p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Qabil</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-900">Explore Somali family lineages publicly</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Search and browse profiles freely. Login is only required when you suggest edits or add people.
        </p>
        <div className="mt-5 flex gap-3">
          <Link className="btn-primary" href="/search">
            Search the tree
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Start with the major 4 qabils</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick a qabil below to begin your journey down the family tree.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {majorStarts.map((qabil) => (
            <Link
              key={qabil.name}
              href={qabil.href}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-500 hover:bg-white"
            >
              <p className="text-lg font-semibold text-slate-900">{qabil.name}</p>
              <p className="mt-1 text-sm text-slate-600">{qabil.summary}</p>
              <p className="mt-3 text-sm font-semibold text-cyan-700">{qabil.cta}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Trending profiles</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {featured.map((person) => (
            <Link
              key={person.id}
              href={`/p/${person.id}`}
              className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-400"
            >
              <p className="font-semibold">{person.name}</p>
              <p className="mt-1 text-sm text-slate-500">ID: {person.id}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
