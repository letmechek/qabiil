import Link from "next/link";
import { Space_Grotesk } from "next/font/google";

import { searchPeople } from "@/lib/services/search.service";

export const dynamic = "force-dynamic";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const MAJOR_QABILS = [
  {
    name: "Darod",
    summary: "Trace Darod lines with verified descendants and lineage depth.",
  },
  {
    name: "Hawiye",
    summary: "Start at Hawiye roots and follow branches across generations.",
  },
  {
    name: "Dir",
    summary: "Browse Dir paths and connected households in one view.",
  },
  {
    name: "Rahanweyn",
    summary: "Explore Rahanweyn records and linked ancestry lines.",
  },
] as const;

export default async function HomePage() {
  const featured = await searchPeople("", 8).catch(() => []);
  const majorStarts = await Promise.all(
    MAJOR_QABILS.map(async (qabil) => {
      if (qabil.name === "Hawiye") {
        return {
          ...qabil,
          href: "/p/572",
          cta: "Start from profile",
        };
      }

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
    <main className={`${spaceGrotesk.className} container-shell py-6`}>
      <section className="somali-future-shell relative overflow-hidden rounded-3xl border border-cyan-100 px-6 py-8 sm:px-10 sm:py-12">
        <div className="somali-grid-overlay" />
        <div className="somali-orb somali-orb-top" />
        <div className="somali-orb somali-orb-bottom" />

        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50/70 px-3 py-1 text-xs font-bold tracking-[0.2em] text-cyan-800 uppercase">
            Qabil // Future Archive
          </p>

          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-slate-900 sm:text-6xl">
            Somali heritage, <span className="somali-gradient-text">reimagined for the next generation</span>
          </h1>

          <p className="mt-4 max-w-3xl text-base text-slate-700 sm:text-lg">
            Discover verified lineages, move across branches fast, and trace each family line with a clean, modern
            explorer built for depth and clarity.
          </p>

          <form action="/search" method="get" className="mt-7">
            <div className="search-glow-shell flex flex-col gap-3 rounded-2xl border border-cyan-200/80 bg-white/80 p-3 backdrop-blur sm:flex-row sm:items-center">
              <input
                name="q"
                placeholder="Try: Ismaeil Saleiban Mahamed"
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
              <button
                type="submit"
                className="h-12 rounded-xl bg-cyan-700 px-5 text-sm font-semibold tracking-wide text-white transition hover:bg-cyan-800"
              >
                Search Lineage
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/search?q=Darod" className="rounded-full border border-cyan-200 bg-white/70 px-3 py-1 text-sm text-cyan-800 hover:bg-cyan-50">
              Darod
            </Link>
            <Link href="/search?q=Hawiye" className="rounded-full border border-cyan-200 bg-white/70 px-3 py-1 text-sm text-cyan-800 hover:bg-cyan-50">
              Hawiye
            </Link>
            <Link href="/search?q=Dir" className="rounded-full border border-cyan-200 bg-white/70 px-3 py-1 text-sm text-cyan-800 hover:bg-cyan-50">
              Dir
            </Link>
            <Link
              href="/search?q=Rahanweyn"
              className="rounded-full border border-cyan-200 bg-white/70 px-3 py-1 text-sm text-cyan-800 hover:bg-cyan-50"
            >
              Rahanweyn
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {majorStarts.map((qabil, idx) => (
          <Link
            key={qabil.name}
            href={qabil.href}
            className="somali-card-anim rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-[0_8px_32px_rgba(15,23,42,0.05)] backdrop-blur"
            style={{ animationDelay: `${idx * 90}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-cyan-700 uppercase">Major Line</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{qabil.name}</p>
              </div>
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                {qabil.cta}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{qabil.summary}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Live Signal: Trending Profiles</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {featured.length} active nodes
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Jump directly into high-traffic lineage records.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((person) => (
            <Link
              key={person.id}
              href={`/p/${person.id}`}
              className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-cyan-500 hover:bg-white"
            >
              <p className="text-lg font-semibold text-slate-900">{person.name}</p>
              <p className="mt-1 text-sm text-slate-500">ID: {person.id}</p>
              <p className="mt-3 text-sm font-semibold text-cyan-700 group-hover:underline">Open profile</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
