import { notFound } from "next/navigation";

import { TreeExplorer } from "@/components/tree/tree-explorer";
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
        <TreeExplorer
          rootPersonId={personId}
          nodes={graph.nodes}
          edges={graph.edges}
          lineage={graph.lineage ?? []}
          descendants={descendants}
          ancestorsDepth={ancestorsDepth}
          descendantsDepth={descendantsDepth}
          view={view}
        />
      </section>
    </main>
  );
}
