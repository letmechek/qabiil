"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  const [mergeByName, setMergeByName] = useState(false);
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.source_person_id)), [nodes]);

  return (
    <>
      <PersonTree
        nodes={nodes}
        edges={edges}
        activeNodeId={activeNodeId}
        onNodeSelect={(id) => setActiveNodeId(id)}
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
          {lineage.map((entry, idx, arr) => {
            const childRelation = arr[idx + 1]?.relation_text ?? "";
            return (
              <li key={`${entry.index}-${entry.name}`} className="text-base text-slate-800">
                {entry.source_person_id && nodeIds.has(entry.source_person_id) ? (
                  <button
                    type="button"
                    className={`font-semibold hover:underline ${
                      activeNodeId === entry.source_person_id ? "text-cyan-700" : "text-slate-900"
                    }`}
                    onClick={() => setActiveNodeId(entry.source_person_id!)}
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
          {descendants.length ? (
            descendants.map((child) => {
              const inGraph = nodeIds.has(child.source_person_id);
              return (
                <button
                  key={child.source_person_id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${
                    activeNodeId === child.source_person_id
                      ? "border-cyan-600 bg-cyan-50 text-cyan-700"
                      : "border-slate-300 text-cyan-700 hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    if (inGraph) {
                      setActiveNodeId(child.source_person_id);
                      return;
                    }
                    router.push(
                      `/tree/${rootPersonId}?ancestorsDepth=${ancestorsDepth}&descendantsDepth=${Math.min(
                        descendantsDepth + 2,
                        12,
                      )}&view=${view}`,
                    );
                  }}
                >
                  {child.name}
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
