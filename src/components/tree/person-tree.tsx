"use client";

import "@xyflow/react/dist/style.css";

import dagre from "@dagrejs/dagre";
import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  MarkerType,
  type Node,
  Position,
} from "@xyflow/react";

type GraphNode = { source_person_id: number; name?: string | null };
type GraphEdge = { from: number; to: number; type: string };
type TreeNodeData = { label: string; representedIds: number[] };

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLayout(nodes: GraphNode[], edges: GraphEdge[], mergeByName: boolean) {
  const visualNodes = new Map<string, { id: string; label: string; representedIds: number[] }>();
  const visualIdBySource = new Map<number, string>();

  for (const node of nodes) {
    const label = node.name ?? `Person ${node.source_person_id}`;
    const normalized = normalizeName(label);
    const visualId = mergeByName && normalized ? `name:${normalized}` : `id:${node.source_person_id}`;
    const existing = visualNodes.get(visualId);

    if (!existing) {
      visualNodes.set(visualId, { id: visualId, label, representedIds: [node.source_person_id] });
    } else {
      existing.representedIds.push(node.source_person_id);
      if (label.length > existing.label.length) existing.label = label;
    }

    visualIdBySource.set(node.source_person_id, visualId);
  }

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: 38,
    ranksep: 110,
    marginx: 24,
    marginy: 24,
  });

  Array.from(visualNodes.values()).forEach((node) => {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  const uniqueEdges = new Map<string, { source: string; target: string }>();
  edges.forEach((edge) => {
    if (edge.from === edge.to) return;
    const source = visualIdBySource.get(edge.from);
    const target = visualIdBySource.get(edge.to);
    if (!source || !target || source === target) return;
    const key = `${source}->${target}`;
    if (!uniqueEdges.has(key)) uniqueEdges.set(key, { source, target });
  });

  uniqueEdges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const rfNodes: Node<TreeNodeData>[] = Array.from(visualNodes.values()).map((node) => {
    const gNode = graph.node(node.id);
    const label = node.representedIds.length > 1 ? `${node.label} (${node.representedIds.length})` : node.label;
    return {
      id: node.id,
      position: {
        x: (gNode?.x ?? 0) - NODE_WIDTH / 2,
        y: (gNode?.y ?? 0) - NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label,
        representedIds: node.representedIds,
      },
      style: {
        width: NODE_WIDTH,
        borderRadius: 14,
        border: "1px solid #0f172a",
        background: "#ffffff",
        fontSize: 16,
        fontWeight: 600,
        textAlign: "center",
        padding: "12px 10px",
      },
    };
  });

  const rfEdges: Edge[] = Array.from(uniqueEdges.values()).map((edge, index) => ({
    id: `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: "#334155",
    },
    style: { stroke: "#64748b", strokeWidth: 1.5 },
  }));

  return { rfNodes, rfEdges };
}

export function PersonTree({
  nodes,
  edges,
  activeNodeId,
  onNodeSelect,
  mergeByName = false,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeNodeId?: number;
  onNodeSelect?: (id: number) => void;
  mergeByName?: boolean;
}) {
  const { rfNodes, rfEdges } = useMemo(() => {
    const layout = buildLayout(nodes, edges, mergeByName);
    if (typeof activeNodeId !== "number") return layout;

    return {
      ...layout,
      rfNodes: layout.rfNodes.map((node) => {
        const represented = (node.data as TreeNodeData | undefined)?.representedIds ?? [];
        if (!represented.includes(activeNodeId)) return node;
        return {
          ...node,
          style: {
            ...node.style,
            background: "#ecfeff",
            border: "2px solid #0891b2",
            boxShadow: "0 0 0 4px rgba(6, 182, 212, 0.18)",
          },
        };
      }),
    };
  }, [nodes, edges, activeNodeId, mergeByName]);

  return (
    <div className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        onNodeClick={(_, node) => {
          const represented = ((node.data as TreeNodeData | undefined)?.representedIds ?? []).filter((id) =>
            Number.isInteger(id),
          );
          if (!onNodeSelect || represented.length === 0) return;
          if (typeof activeNodeId === "number" && represented.includes(activeNodeId)) {
            onNodeSelect(activeNodeId);
            return;
          }
          onNodeSelect(represented[0]);
        }}
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background color="#cbd5e1" gap={42} size={1.5} />
      </ReactFlow>
    </div>
  );
}
