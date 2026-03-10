import { notFound } from "next/navigation";
import Link from "next/link";

import { DescendantsTreeNode, getDescendantsTree, getPersonById } from "@/lib/services/people.service";

export const dynamic = "force-dynamic";

function buildLineage(person: Awaited<ReturnType<typeof getPersonById>>) {
  if (!person) return [];
  const entries = Array.isArray(person.genealogy) ? person.genealogy : [];
  if (!entries.length) {
    return [
      {
        index: 1,
        name: person.name ?? person.names?.[0] ?? `Person ${person.source_person_id}`,
        source_person_id: person.source_person_id,
        relation_text: person.name ?? "",
      },
    ];
  }

  return entries
    .slice()
    .sort((a, b) => Number(a?.index ?? 9999) - Number(b?.index ?? 9999))
    .map((entry, idx) => ({
      index: typeof entry?.index === "number" ? entry.index : idx + 1,
      name: typeof entry?.name === "string" ? entry.name : `Person ${idx + 1}`,
      source_person_id:
        typeof entry?.source_person_id === "number"
          ? entry.source_person_id
          : idx === 0
            ? person.source_person_id
            : null,
      relation_text: typeof entry?.relation_text === "string" ? entry.relation_text : "",
    }));
}

function DescendantsList({
  node,
  rootId,
  querySuffix,
}: {
  node: DescendantsTreeNode;
  rootId: number;
  querySuffix: string;
}) {
  const isRoot = node.source_person_id === rootId;

  return (
    <li className="mb-2">
      {isRoot ? (
        <span className="font-semibold text-cyan-800">{node.name}</span>
      ) : (
        <Link className="font-medium text-cyan-700 hover:underline" href={`/tree/${node.source_person_id}${querySuffix}`}>
          {node.name}
        </Link>
      )}
      {node.children.length ? (
        <ul className="mt-2 ml-5 border-l border-slate-200 pl-4">
          {node.children.map((child) => (
            <DescendantsList key={child.source_person_id} node={child} rootId={rootId} querySuffix={querySuffix} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function TreePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ qline?: string; depth?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const personId = Number(id);
  const lineQuery = (query.qline ?? "").trim();
  const selectedDepth = clampDepth(Number(query.depth), 12);

  const person = await getPersonById(personId);
  if (!person) notFound();
  const lineage = buildLineage(person);
  const descendantsTree = await getDescendantsTree(personId, { maxDepth: selectedDepth, maxNodes: 1500 });
  const filteredTree = descendantsTree ? filterTreeByLine(descendantsTree, lineQuery) : null;
  const totalDescendants = filteredTree ? countDescendants(filteredTree) - 1 : 0;
  const querySuffix = buildQuerySuffix(lineQuery, selectedDepth);

  return (
    <main className="container-shell py-4">
      <section className="card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Tree for {person.name ?? `Person ${personId}`}</h1>
          <p className="text-sm text-slate-500">{totalDescendants} descendants listed</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Lineage Trace</h2>
          <p className="mt-1 text-sm text-slate-600">Verified chain from this person upward.</p>
          <ol className="mt-4 list-decimal space-y-2 pl-6">
            {lineage.map((entry, idx, arr) => {
              const childRelation = arr[idx + 1]?.relation_text ?? "";
              return (
                <li key={`${entry.index}-${entry.name}`} className="text-base text-slate-800">
                  {entry.source_person_id ? (
                    <Link className="font-semibold text-cyan-700 hover:underline" href={`/tree/${entry.source_person_id}${querySuffix}`}>
                      {entry.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{entry.name}</span>
                  )}
                  {childRelation ? <span className="ml-2 text-sm text-slate-500">({childRelation})</span> : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-lg font-semibold">Descendants Tree</h3>
          <p className="mt-1 text-sm text-slate-600">
            Simple father to descendants chain using full names where available.
          </p>
          <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]" method="get">
            <input
              name="qline"
              defaultValue={lineQuery}
              placeholder="Filter line by name (e.g. Osman Mahamud)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="depth"
              defaultValue={String(selectedDepth)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((depth) => (
                <option key={depth} value={depth}>
                  Depth {depth}
                </option>
              ))}
            </select>
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50" type="submit">
              Apply
            </button>
          </form>

          {filteredTree ? (
            <ul className="mt-4">
              <DescendantsList node={filteredTree} rootId={personId} querySuffix={querySuffix} />
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No descendants listed in this record.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function countDescendants(node: DescendantsTreeNode): number {
  let count = 1;
  for (const child of node.children) count += countDescendants(child);
  return count;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function filterTreeByLine(node: DescendantsTreeNode, rawQuery: string): DescendantsTreeNode | null {
  const query = normalizeText(rawQuery);
  const queryTokens = query.split(" ").filter(Boolean);

  const recurse = (current: DescendantsTreeNode, isRoot = false): DescendantsTreeNode | null => {
    const filteredChildren = current.children
      .map((child) => recurse(child, false))
      .filter((child): child is DescendantsTreeNode => Boolean(child));

    if (!queryTokens.length) {
      return { ...current, children: filteredChildren };
    }

    const currentName = normalizeText(current.name);
    const matchesSelf = queryTokens.every((token) => currentName.includes(token));
    if (isRoot || matchesSelf || filteredChildren.length) {
      return { ...current, children: filteredChildren };
    }

    return null;
  };

  return recurse(node, true);
}

function clampDepth(value: number, fallback: number) {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(12, Math.max(1, value));
}

function buildQuerySuffix(qline: string, depth: number) {
  const params = new URLSearchParams();
  if (qline.trim()) params.set("qline", qline.trim());
  if (depth !== 12) params.set("depth", String(depth));
  const query = params.toString();
  return query ? `?${query}` : "";
}
