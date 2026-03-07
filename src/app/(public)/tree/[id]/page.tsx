import { notFound } from "next/navigation";
import Link from "next/link";

import { PersonTree } from "@/components/tree/person-tree";
import { getDirectDescendants, getPersonById, getRelativesGraph } from "@/lib/services/people.service";

export const dynamic = "force-dynamic";

function parseDepth(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = Number(raw);
  if (!Number.isInteger(num)) return fallback;
  return Math.min(8, Math.max(1, num));
}

function parseView(value: string | undefined) {
  if (value === "chain") return "chain";
  if (value === "chain_siblings") return "chain_siblings";
  return "full";
}

export default async function TreePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ancestorsDepth?: string; descendantsDepth?: string; view?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const personId = Number(id);
  const ancestorsDepth = parseDepth(query.ancestorsDepth, 5);
  const descendantsDepth = parseDepth(query.descendantsDepth, 5);
  const view = parseView(query.view);
  const includeSiblings = view !== "chain";
  const includeDescendants = view === "full";

  const person = await getPersonById(personId);
  if (!person) notFound();
  const descendants = await getDirectDescendants(personId);

  const graph = await getRelativesGraph(personId, ancestorsDepth, descendantsDepth, {
    includeSiblings,
    includeDescendants,
  });

  return (
    <main className="container-shell py-4">
      <section className="card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Tree for {person.name ?? `Person ${personId}`}</h1>
          <p className="text-sm text-slate-500">
            Depth: {ancestorsDepth}/{descendantsDepth}
          </p>
        </div>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <a
            className="rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-100"
            href={`/tree/${personId}?ancestorsDepth=5&descendantsDepth=5&view=${view}`}
          >
            Standard depth
          </a>
          <a
            className="rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-100"
            href={`/tree/${personId}?ancestorsDepth=8&descendantsDepth=8&view=${view}`}
          >
            Deeper tree
          </a>
          <a
            className={`rounded-full border px-3 py-1 ${view === "chain" ? "border-cyan-600 bg-cyan-50 text-cyan-700" : "border-slate-300 hover:bg-slate-100"}`}
            href={`/tree/${personId}?ancestorsDepth=${ancestorsDepth}&descendantsDepth=${descendantsDepth}&view=chain`}
          >
            Chain only
          </a>
          <a
            className={`rounded-full border px-3 py-1 ${view === "chain_siblings" ? "border-cyan-600 bg-cyan-50 text-cyan-700" : "border-slate-300 hover:bg-slate-100"}`}
            href={`/tree/${personId}?ancestorsDepth=${ancestorsDepth}&descendantsDepth=${descendantsDepth}&view=chain_siblings`}
          >
            Chain + siblings
          </a>
          <a
            className={`rounded-full border px-3 py-1 ${view === "full" ? "border-cyan-600 bg-cyan-50 text-cyan-700" : "border-slate-300 hover:bg-slate-100"}`}
            href={`/tree/${personId}?ancestorsDepth=${ancestorsDepth}&descendantsDepth=${descendantsDepth}&view=full`}
          >
            Full tree
          </a>
        </div>
        <PersonTree nodes={graph.nodes} edges={graph.edges} />
        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Lineage Trace</h2>
          <p className="mt-1 text-sm text-slate-600">
            Follow the verified genealogy chain. Click any linked person to continue tracing.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-6">
            {(graph.lineage ?? []).map(
              (entry: {
                index: number;
                name: string;
                relation_text: string;
                source_person_id: number | null;
              }) => (
                <li key={`${entry.index}-${entry.name}`} className="text-base text-slate-800">
                  {entry.source_person_id ? (
                    <Link className="font-semibold text-cyan-700 hover:underline" href={`/tree/${entry.source_person_id}`}>
                      {entry.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{entry.name}</span>
                  )}
                  {entry.relation_text ? (
                    <span className="ml-2 text-sm text-slate-500">({entry.relation_text})</span>
                  ) : null}
                </li>
              ),
            )}
          </ol>
        </section>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-lg font-semibold">Direct Descendants</h3>
          <p className="mt-1 text-sm text-slate-600">
            Click a descendant to continue deeper down the chain.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {descendants.length ? (
              descendants.map((child) => (
                <Link
                  key={child.source_person_id}
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-cyan-700 hover:bg-slate-50"
                  href={`/tree/${child.source_person_id}?ancestorsDepth=${ancestorsDepth}&descendantsDepth=${descendantsDepth}&view=${view}`}
                >
                  {child.name}
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">No direct descendants listed in this record.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
