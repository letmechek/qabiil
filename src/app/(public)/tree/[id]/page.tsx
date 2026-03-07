import { notFound } from "next/navigation";

import { PersonTree } from "@/components/tree/person-tree";
import { getPersonById, getRelativesGraph } from "@/lib/services/people.service";

export const dynamic = "force-dynamic";

function parseDepth(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = Number(raw);
  if (!Number.isInteger(num)) return fallback;
  return Math.min(8, Math.max(1, num));
}

export default async function TreePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ancestorsDepth?: string; descendantsDepth?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const personId = Number(id);
  const ancestorsDepth = parseDepth(query.ancestorsDepth, 5);
  const descendantsDepth = parseDepth(query.descendantsDepth, 5);

  const person = await getPersonById(personId);
  if (!person) notFound();

  const graph = await getRelativesGraph(personId, ancestorsDepth, descendantsDepth);

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
            href={`/tree/${personId}?ancestorsDepth=5&descendantsDepth=5`}
          >
            Standard depth
          </a>
          <a
            className="rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-100"
            href={`/tree/${personId}?ancestorsDepth=8&descendantsDepth=8`}
          >
            Deeper tree
          </a>
        </div>
        <PersonTree nodes={graph.nodes} edges={graph.edges} />
      </section>
    </main>
  );
}
