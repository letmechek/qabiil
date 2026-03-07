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

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

function buildLayout(nodes: GraphNode[], edges: GraphEdge[]) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: 38,
    ranksep: 110,
    marginx: 24,
    marginy: 24,
  });

  nodes.forEach((node) => {
    graph.setNode(String(node.source_person_id), {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  const uniqueEdges = new Map<string, GraphEdge>();
  edges.forEach((edge) => {
    if (edge.from === edge.to) return;
    const key = `${edge.from}->${edge.to}`;
    if (!uniqueEdges.has(key)) uniqueEdges.set(key, edge);
  });

  uniqueEdges.forEach((edge) => {
    graph.setEdge(String(edge.from), String(edge.to));
  });

  dagre.layout(graph);

  const rfNodes: Node[] = nodes.map((node) => {
    const gNode = graph.node(String(node.source_person_id));
    return {
      id: String(node.source_person_id),
      position: {
        x: (gNode?.x ?? 0) - NODE_WIDTH / 2,
        y: (gNode?.y ?? 0) - NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: node.name ?? `Person ${node.source_person_id}`,
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
    id: `${edge.from}-${edge.to}-${index}`,
    source: String(edge.from),
    target: String(edge.to),
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
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const { rfNodes, rfEdges } = useMemo(() => buildLayout(nodes, edges), [nodes, edges]);

  return (
    <div className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white">
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView fitViewOptions={{ padding: 0.15 }}>
        <MiniMap pannable zoomable />
        <Controls />
        <Background color="#cbd5e1" gap={42} size={1.5} />
      </ReactFlow>
    </div>
  );
}
