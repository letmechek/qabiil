"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PersonTree } from "@/components/tree/person-tree";

type TreeNode = {
  source_person_id: number;
  name?: string | null;
};

type TreeEdge = {
  from: number;
  to: number;
  type: string;
};

type LineageEntry = {
  index: number;
  name: string;
  relation_text: string;
  source_person_id: number | null;
};

type Descendant = {
  source_person_id: number;
  name: string;
};

export function TreeExplorer({
  rootPersonId,
  nodes,
  edges,
  lineage,
  descendants,
  ancestorsDepth,
  descendantsDepth,
  view,
}: {
  rootPersonId: number;
  nodes: TreeNode[];
  edges: TreeEdge[];
  lineage: LineageEntry[];
  descendants: Descendant[];
  ancestorsDepth: number;
  descendantsDepth: number;
  view: "chain" | "chain_siblings" | "full";
}) {
  const router = useRouter();
  const [activeNodeId, setActiveNodeId] = useState(rootPersonId);
  const [focusedPersonId, setFocusedPersonId] = useState(rootPersonId);
  const [focusedContext, setFocusedContext] = useState<
    Record<number, { lineage: LineageEntry[]; descendants: Descendant[] }>
  >({});
  const [mergeByName, setMergeByName] = useState(true);
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.source_person_id)), [nodes]);
  const displayLineage =
    focusedPersonId === rootPersonId ? lineage : focusedContext[focusedPersonId]?.lineage ?? lineage;
  const displayDescendants =
    focusedPersonId === rootPersonId
      ? descendants
      : focusedContext[focusedPersonId]?.descendants ?? descendants;
  const descendantGroups = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/["']/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const groups = new Map<string, { label: string; ids: number[] }>();
    for (const child of displayDescendants) {
      const key = normalize(child.name) || `id:${child.source_person_id}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { label: child.name, ids: [child.source_person_id] });
      } else {
        existing.ids.push(child.source_person_id);
        if (child.name.length > existing.label.length) existing.label = child.name;
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [displayDescendants]);

  useEffect(() => {
    console.log("[Direct Descendants]", {
      personId: rootPersonId,
      count: descendants.length,
      descendants,
    });
  }, [rootPersonId, descendants]);

  useEffect(() => {
    if (focusedPersonId === rootPersonId) return;
    let cancelled = false;

    void Promise.all([
      fetch(`/api/people/${focusedPersonId}`).then((res) => res.json()),
      fetch(`/api/people/${focusedPersonId}/descendants`).then((res) => res.json()),
    ]).then(([personPayload, descendantsPayload]) => {
      if (cancelled) return;

      const person = personPayload ?? {};
      const entries: Array<{
        index?: unknown;
        name?: unknown;
        source_person_id?: unknown;
        relation_text?: unknown;
      }> = Array.isArray(person.genealogy) ? person.genealogy : [];
      const nextLineage: LineageEntry[] = entries.length
        ? entries
            .slice()
            .sort((a, b) => (Number(a?.index ?? 9999) - Number(b?.index ?? 9999)))
            .map((entry, idx) => ({
              index: typeof entry?.index === "number" ? entry.index : idx + 1,
              name:
                typeof entry?.name === "string"
                  ? entry.name
                  : idx === 0
                    ? (person.name ?? `Person ${focusedPersonId}`)
                    : `Person ${idx + 1}`,
              source_person_id:
                typeof entry?.source_person_id === "number"
                  ? entry.source_person_id
                  : idx === 0
                    ? focusedPersonId
                    : null,
              relation_text: typeof entry?.relation_text === "string" ? entry.relation_text : "",
            }))
        : [
            {
              index: 1,
              name: person.name ?? `Person ${focusedPersonId}`,
              source_person_id: focusedPersonId,
              relation_text: person.name ?? "",
            },
          ];

      const nextDescendants = Array.isArray(descendantsPayload?.descendants)
        ? descendantsPayload.descendants
        : [];
      console.log("[Direct Descendants]", {
        personId: focusedPersonId,
        count: nextDescendants.length,
        descendants: nextDescendants,
      });

      setFocusedContext((prev) => ({
        ...prev,
        [focusedPersonId]: {
          lineage: nextLineage,
          descendants: nextDescendants,
        },
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [focusedPersonId, rootPersonId]);

  return (
    <>
      <PersonTree
        nodes={nodes}
        edges={edges}
        activeNodeId={activeNodeId}
        onNodeSelect={(id) => {
          setActiveNodeId(id);
          setFocusedPersonId(id);
        }}
        mergeByName={mergeByName}
      />
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Merge Same Names</p>
          <p className="text-xs text-slate-500">Visually combines identical names while preserving person IDs underneath.</p>
        </div>
        <button
          type="button"
          className={`rounded-full border px-3 py-1 text-sm ${
            mergeByName
              ? "border-cyan-600 bg-cyan-50 text-cyan-700"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => setMergeByName((v) => !v)}
        >
          {mergeByName ? "On" : "Off"}
        </button>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h2 className="text-xl font-semibold">Lineage Trace</h2>
        <p className="mt-1 text-sm text-slate-600">
          Follow the verified genealogy chain. Click any linked person to focus them in the tree.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-6">
          {displayLineage.map((entry, idx, arr) => {
            const childRelation = arr[idx + 1]?.relation_text ?? "";
            return (
              <li key={`${entry.index}-${entry.name}`} className="text-base text-slate-800">
                {entry.source_person_id && nodeIds.has(entry.source_person_id) ? (
                  <button
                    type="button"
                    className={`font-semibold hover:underline ${
                      activeNodeId === entry.source_person_id ? "text-cyan-700" : "text-slate-900"
                    }`}
                    onClick={() => {
                      setActiveNodeId(entry.source_person_id!);
                      setFocusedPersonId(entry.source_person_id!);
                    }}
                  >
                    {entry.name}
                  </button>
                ) : entry.source_person_id ? (
                  <Link
                    className="font-semibold text-cyan-700 hover:underline"
                    href={`/tree/${entry.source_person_id}?ancestorsDepth=${ancestorsDepth}&descendantsDepth=${descendantsDepth}&view=${view}`}
                  >
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
        <h3 className="text-lg font-semibold">Direct Descendants</h3>
        <p className="mt-1 text-sm text-slate-600">Click a descendant to focus and continue down the chain.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {descendantGroups.length ? (
            descendantGroups.map((group) => {
              const inGraphId = group.ids.find((id) => nodeIds.has(id));
              const isActive = group.ids.includes(activeNodeId);
              const targetId = inGraphId ?? group.ids[0];
              return (
                <button
                  key={`${group.label}-${group.ids.join(",")}`}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${
                    isActive
                      ? "border-cyan-600 bg-cyan-50 text-cyan-700"
                      : "border-slate-300 text-cyan-700 hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    if (inGraphId) {
                      setActiveNodeId(inGraphId);
                      setFocusedPersonId(inGraphId);
                      return;
                    }
                    router.push(
                      `/tree/${targetId}?ancestorsDepth=${ancestorsDepth}&descendantsDepth=${Math.min(
                        descendantsDepth + 2,
                        12,
                      )}&view=${view}`,
                    );
                  }}
                >
                  {group.label}
                  {group.ids.length > 1 ? ` (${group.ids.length})` : ""}
                </button>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">No direct descendants listed in this record.</p>
          )}
        </div>
      </section>
    </>
  );
}
