import { Filter, ObjectId } from "mongodb";

import {
  countersCollection,
  peopleCollection,
} from "@/lib/db/collections";
import type { ChildGroup, PersonDoc } from "@/lib/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function getPersonById(sourcePersonId: number) {
  const people = await peopleCollection();
  return people.findOne({ source: "abtirsi", source_person_id: sourcePersonId });
}

async function getPeopleByIds(sourcePersonIds: number[]) {
  if (!sourcePersonIds.length) return new Map<number, PersonDoc>();
  const people = await peopleCollection();
  const docs = await people
    .find(
      { source: "abtirsi", source_person_id: { $in: sourcePersonIds } },
      {
        projection: {
          source_person_id: 1,
          name: 1,
          names: 1,
          father: 1,
          mother: 1,
          father_id: 1,
          mother_id: 1,
          children_group: 1,
          children_groups: 1,
          siblings_groups: 1,
          genealogy: 1,
        },
      },
    )
    .toArray();

  return new Map(docs.map((doc) => [doc.source_person_id, doc]));
}

async function getChildrenLinksForParents(parentIds: number[], knownParents?: Map<number, PersonDoc>) {
  const links = new Map<number, Set<number>>();
  const parentSet = new Set(parentIds);
  for (const id of parentIds) links.set(id, new Set<number>());

  if (!parentIds.length) return links;

  const people = await peopleCollection();
  const reverseChildren = await people
    .find(
      {
        source: "abtirsi",
        $or: [
          { "father.source_person_id": { $in: parentIds } },
          { "mother.source_person_id": { $in: parentIds } },
          { father_id: { $in: parentIds } },
          { mother_id: { $in: parentIds } },
        ],
      },
      { projection: { source_person_id: 1, father: 1, mother: 1, father_id: 1, mother_id: 1 } },
    )
    .toArray();

  for (const child of reverseChildren) {
    const childId = toPersonId(child.source_person_id);
    if (typeof childId !== "number") continue;

    const possibleParents = [
      toPersonId(child.father?.source_person_id),
      toPersonId(child.mother?.source_person_id),
      toPersonId(child.father_id),
      toPersonId(child.mother_id),
    ];

    for (const parentId of possibleParents) {
      if (typeof parentId !== "number" || !parentSet.has(parentId)) continue;
      links.get(parentId)?.add(childId);
    }
  }

  if (knownParents) {
    for (const parentId of parentIds) {
      const parent = knownParents.get(parentId);
      if (!parent) continue;
      for (const childId of getChildrenIds(parent)) {
        links.get(parentId)?.add(childId);
      }
    }
  }

  return links;
}

export async function getRelativesGraph(
  sourcePersonId: number,
  ancestorsDepth: number,
  descendantsDepth: number,
  options?: {
    includeSiblings?: boolean;
    includeDescendants?: boolean;
  },
) {
  const includeSiblings = options?.includeSiblings ?? true;
  const includeDescendants = options?.includeDescendants ?? true;
  const nodes = new Map<number, PersonDoc>();
  const edges: Array<{ from: number; to: number; type: "PARENT" | "CHILD" }> = [];
  const edgeKeys = new Set<string>();

  const startMap = await getPeopleByIds([sourcePersonId]);
  const start = startMap.get(sourcePersonId);
  if (!start) return { nodes: [], edges: [], lineage: [] };

  nodes.set(start.source_person_id, start);
  const lineage = getLineageEntries(start);
  const chainIds = getGenealogyChainIds(start);

  const chainPeople = await getPeopleByIds(chainIds);
  for (const id of chainIds) if (chainPeople.get(id)) nodes.set(id, chainPeople.get(id)!);

  // Build authoritative ancestor edges from genealogy order:
  // genealogy[1] is direct parent of genealogy[0], etc.
  for (let i = 1; i < chainIds.length; i += 1) {
    const parentId = chainIds[i];
    const childId = chainIds[i - 1];
    if (parentId === childId) continue;
    const edgeKey = `${parentId}->${childId}`;
    if (!edgeKeys.has(edgeKey)) {
      edges.push({ from: parentId, to: childId, type: "PARENT" });
      edgeKeys.add(edgeKey);
    }
  }

  if (includeDescendants) {
    let currentLevel = new Set<number>([sourcePersonId]);
    let depth = 0;

    while (currentLevel.size && depth < descendantsDepth) {
      const parentIds = Array.from(currentLevel);
      const parentDocs = new Map<number, PersonDoc>();
      for (const parentId of parentIds) {
        const parent = nodes.get(parentId);
        if (parent) parentDocs.set(parentId, parent);
      }

      const links = await getChildrenLinksForParents(parentIds, parentDocs);
      const nextLevel = new Set<number>();

      for (const parentId of parentIds) {
        const childIds = Array.from(links.get(parentId) ?? []);
        for (const childId of childIds) {
          if (childId === parentId) continue;
          const edgeKey = `${parentId}->${childId}`;
          if (!edgeKeys.has(edgeKey)) {
            edges.push({ from: parentId, to: childId, type: "CHILD" });
            edgeKeys.add(edgeKey);
          }
          nextLevel.add(childId);
        }
      }

      const missingChildIds = Array.from(nextLevel).filter((id) => !nodes.has(id));
      const childDocs = await getPeopleByIds(missingChildIds);
      childDocs.forEach((doc) => nodes.set(doc.source_person_id, doc));
      currentLevel = nextLevel;
      depth += 1;
    }
  }

  if (includeSiblings) {
    const siblingRefs = getSiblingRefs(start);
    const siblingDocs = await getPeopleByIds(siblingRefs.map((s) => s.source_person_id));
    for (const siblingRef of siblingRefs) {
      if (siblingRef.source_person_id === sourcePersonId) continue;
      const sibling = siblingDocs.get(siblingRef.source_person_id);
      if (!sibling) continue;
      nodes.set(sibling.source_person_id, sibling);

      const parentIdFromLineage = chainIds[1];
      if (typeof parentIdFromLineage === "number") {
        const edgeKey = `${parentIdFromLineage}->${sibling.source_person_id}`;
        if (!edgeKeys.has(edgeKey)) {
          edges.push({ from: parentIdFromLineage, to: sibling.source_person_id, type: "CHILD" });
          edgeKeys.add(edgeKey);
        }
      } else {
        const parentIds = [getParentId(start, "father"), getParentId(start, "mother")].filter(
          (id): id is number => typeof id === "number",
        );
        for (const parentId of parentIds) {
          const edgeKey = `${parentId}->${sibling.source_person_id}`;
          if (!edgeKeys.has(edgeKey)) {
            edges.push({ from: parentId, to: sibling.source_person_id, type: "CHILD" });
            edgeKeys.add(edgeKey);
          }
        }
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()).map((node) => ({
      source_person_id: node.source_person_id,
      name: node.name ?? node.names?.[0] ?? null,
    })),
    edges,
    lineage,
  };
}

function getGenealogyChainIds(person: PersonDoc) {
  const ids: number[] = [person.source_person_id];
  const entries = Array.isArray(person.genealogy) ? person.genealogy : [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const index = (entry as { index?: unknown }).index;
    const entryId = (entry as { source_person_id?: unknown }).source_person_id;
    if (typeof index !== "number" || index < 2) continue;
    if (typeof entryId !== "number") continue;
    if (ids.includes(entryId)) continue;
    ids.push(entryId);
  }

  // If no genealogy IDs are present, fallback to parent traversal depth.
  if (ids.length === 1) {
    const fallbackParentId = getParentId(person, "father") ?? getParentId(person, "mother");
    if (typeof fallbackParentId === "number") ids.push(fallbackParentId);
  }

  return ids;
}

function getLineageEntries(person: PersonDoc) {
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
    .sort((a, b) => {
      const ai = typeof a?.index === "number" ? a.index : 99999;
      const bi = typeof b?.index === "number" ? b.index : 99999;
      return ai - bi;
    })
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

function getParentId(person: PersonDoc, side: "father" | "mother") {
  const explicitId = toPersonId(person[`${side}_id` as keyof PersonDoc]);
  if (typeof explicitId === "number") return explicitId;

  const ref = person[side] as { source_person_id?: unknown } | null | undefined;
  return toPersonId(ref?.source_person_id);
}

function getChildrenIds(person: PersonDoc) {
  const ids = new Set<number>();
  const legacyGroups = person.children_group ?? [];
  const groupedChildren = person.children_groups ?? [];

  for (const group of legacyGroups) {
    for (const childId of group.children_ids ?? []) {
      const normalizedChildId = toPersonId(childId);
      if (typeof normalizedChildId === "number") ids.add(normalizedChildId);
    }
  }

  for (const group of groupedChildren) {
    for (const child of group.children ?? []) {
      const childId = getRefPersonId(child);
      if (typeof childId === "number") ids.add(childId);
    }
  }

  return Array.from(ids);
}

function getChildrenRefs(person: PersonDoc) {
  const refs = new Map<number, { source_person_id: number; name?: string }>();
  const legacyGroups = person.children_group ?? [];
  const groupedChildren = person.children_groups ?? [];

  for (const group of legacyGroups) {
    for (const childId of group.children_ids ?? []) {
      const normalizedChildId = toPersonId(childId);
      if (typeof normalizedChildId !== "number" || refs.has(normalizedChildId)) continue;
      refs.set(normalizedChildId, { source_person_id: normalizedChildId });
    }
  }

  for (const group of groupedChildren) {
    for (const child of group.children ?? []) {
      const childId = getRefPersonId(child);
      if (typeof childId !== "number") continue;
      const childName =
        child && typeof child === "object" && typeof (child as { name?: unknown }).name === "string"
          ? (child as { name: string }).name
          : undefined;
      const existing = refs.get(childId);
      refs.set(childId, {
        source_person_id: childId,
        name: pickBestName(existing?.name, childName),
      });
    }
  }

  return refs;
}

function getRefPersonId(ref: unknown) {
  if (!ref || typeof ref !== "object") return null;

  const candidate = ref as {
    source_person_id?: unknown;
    person_id?: unknown;
    id?: unknown;
    person?: { source_person_id?: unknown; person_id?: unknown; id?: unknown };
  };

  return (
    toPersonId(candidate.source_person_id) ??
    toPersonId(candidate.person_id) ??
    toPersonId(candidate.id) ??
    toPersonId(candidate.person?.source_person_id) ??
    toPersonId(candidate.person?.person_id) ??
    toPersonId(candidate.person?.id)
  );
}

function toPersonId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value.trim())) return Number(value.trim());
  return null;
}

function pickBestName(...candidates: Array<string | null | undefined>) {
  const normalized = candidates
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter((name) => name.length > 0);

  if (!normalized.length) return undefined;

  const sorted = normalized.sort((a, b) => scoreName(b) - scoreName(a));
  return sorted[0];
}

function scoreName(name: string) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  const tokenCount = cleaned.split(" ").filter(Boolean).length;
  const lettersOnly = cleaned.replace(/[^A-Za-z]/g, "");
  const uniqueChars = new Set(lettersOnly.toLowerCase().split("")).size;
  const singleWordPenalty = tokenCount === 1 ? 20 : 0;

  return tokenCount * 100 + cleaned.length + uniqueChars - singleWordPenalty;
}

function getSortedGenealogyNames(person: PersonDoc) {
  if (!Array.isArray(person.genealogy)) return [];

  return person.genealogy
    .filter(
      (entry): entry is { index?: unknown; name?: unknown } =>
        !!entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string",
    )
    .slice()
    .sort((a, b) => {
      const ai = typeof a.index === "number" ? a.index : Number.MAX_SAFE_INTEGER;
      const bi = typeof b.index === "number" ? b.index : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    })
    .map((entry) => (entry.name as string).trim())
    .filter(Boolean);
}

function buildFullNameFromGenealogy(person: PersonDoc) {
  const names = getSortedGenealogyNames(person);
  if (names.length < 2) return undefined;

  const parts: string[] = [];
  for (const name of names) {
    if (parts[parts.length - 1] === name) continue;
    parts.push(name);
    if (parts.length >= 4) break;
  }

  return parts.length >= 2 ? parts.join(" ") : undefined;
}

function getBestDescendantName(person: PersonDoc, fallback?: string) {
  const fullFromGenealogy = buildFullNameFromGenealogy(person);
  return (
    pickBestName(
      fallback,
      fullFromGenealogy,
      person.name,
      person.names?.[0],
      ...(Array.isArray(person.names) ? person.names : []),
    ) ?? fallback
  );
}

async function getChildrenIdsForPerson(sourcePersonId: number, person?: PersonDoc) {
  const ids = new Set<number>();
  const hasChildrenGroupsField =
    !!person &&
    (Object.prototype.hasOwnProperty.call(person, "children_groups") ||
      Object.prototype.hasOwnProperty.call(person, "children_group"));
  let hasExplicitChildren = false;

  if (person) {
    for (const id of getChildrenIds(person)) {
      ids.add(id);
      hasExplicitChildren = true;
    }
  }

  // If the source record explicitly lists children, trust that list.
  if (hasExplicitChildren) {
    return Array.from(ids);
  }

  const people = await peopleCollection();
  const genealogyChildren = await people
    .find(
      {
        source: "abtirsi",
        genealogy: {
          $elemMatch: {
            index: 2,
            source_person_id: sourcePersonId,
          },
        },
      },
      { projection: { source_person_id: 1 } },
    )
    .limit(4000)
    .toArray();

  for (const child of genealogyChildren) {
    if (typeof child.source_person_id === "number") ids.add(child.source_person_id);
  }

  // If this record has children groups field but no explicit children, prefer genealogy-derived
  // direct children and avoid looser reverse-parent links that can be noisy in source data.
  if (hasChildrenGroupsField) {
    return Array.from(ids);
  }

  if (ids.size) {
    return Array.from(ids);
  }

  const reverseChildren = await people
    .find(
      {
        source: "abtirsi",
        $or: [
          { "father.source_person_id": sourcePersonId },
          { "mother.source_person_id": sourcePersonId },
          { father_id: sourcePersonId },
          { mother_id: sourcePersonId },
        ],
      },
      { projection: { source_person_id: 1 } },
    )
    .limit(2000)
    .toArray();

  for (const child of reverseChildren) {
    if (typeof child.source_person_id === "number") ids.add(child.source_person_id);
  }

  return Array.from(ids);
}

export async function getDirectDescendants(sourcePersonId: number) {
  const personMap = await getPeopleByIds([sourcePersonId]);
  const person = personMap.get(sourcePersonId);
  const embeddedRefs = person ? getChildrenRefs(person) : new Map<number, { source_person_id: number; name?: string }>();
  const ids = await getChildrenIdsForPerson(sourcePersonId, person ?? undefined);
  const childMap = await getPeopleByIds(ids);
  const outMap = new Map<number, { source_person_id: number; name: string }>();

  // Keep children explicitly listed in children_groups, even if no standalone person doc exists yet.
  for (const [childId, ref] of embeddedRefs) {
    outMap.set(childId, {
      source_person_id: childId,
      name: pickBestName(ref.name, `Person ${childId}`) ?? `Person ${childId}`,
    });
  }

  for (const child of childMap.values()) {
    const existing = outMap.get(child.source_person_id);
    outMap.set(child.source_person_id, {
      source_person_id: child.source_person_id,
      name: getBestDescendantName(child, existing?.name ?? `Person ${child.source_person_id}`) ?? `Person ${child.source_person_id}`,
    });
  }

  for (const childId of ids) {
    if (!outMap.has(childId)) {
      outMap.set(childId, {
        source_person_id: childId,
        name: `Person ${childId}`,
      });
    }
  }

  const out = Array.from(outMap.values());

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export type DescendantsTreeNode = {
  source_person_id: number;
  name: string;
  children: DescendantsTreeNode[];
};

export async function getDescendantsTree(
  rootPersonId: number,
  options?: {
    maxDepth?: number;
    maxNodes?: number;
  },
) {
  const maxDepth = Math.max(1, options?.maxDepth ?? 10);
  const maxNodes = Math.max(10, options?.maxNodes ?? 1200);

  const root = await getPersonById(rootPersonId);
  if (!root) return null;

  const rootNode: DescendantsTreeNode = {
    source_person_id: rootPersonId,
    name: getBestDescendantName(root, `Person ${rootPersonId}`) ?? `Person ${rootPersonId}`,
    children: [],
  };

  const nodeById = new Map<number, DescendantsTreeNode>([[rootPersonId, rootNode]]);
  const visited = new Set<number>([rootPersonId]);
  let currentLevel: number[] = [rootPersonId];
  let depth = 0;

  while (currentLevel.length && depth < maxDepth && nodeById.size < maxNodes) {
    const levelResults = await Promise.all(
      currentLevel.map(async (parentId) => ({
        parentId,
        children: await getDirectDescendants(parentId),
      })),
    );

    const nextLevel: number[] = [];

    for (const { parentId, children } of levelResults) {
      const parentNode = nodeById.get(parentId);
      if (!parentNode) continue;

      const dedupedChildren = new Map<number, { source_person_id: number; name: string }>();
      for (const child of children) {
        if (child.source_person_id === parentId) continue;
        if (!dedupedChildren.has(child.source_person_id)) {
          dedupedChildren.set(child.source_person_id, child);
        }
      }

      const sortedChildren = Array.from(dedupedChildren.values()).sort((a, b) => a.name.localeCompare(b.name));
      for (const child of sortedChildren) {
        if (visited.has(child.source_person_id)) continue;
        if (nodeById.size >= maxNodes) break;

        const childNode: DescendantsTreeNode = {
          source_person_id: child.source_person_id,
          name: child.name,
          children: [],
        };

        parentNode.children.push(childNode);
        nodeById.set(child.source_person_id, childNode);
        visited.add(child.source_person_id);
        nextLevel.push(child.source_person_id);
      }
    }

    currentLevel = nextLevel;
    depth += 1;
  }

  return rootNode;
}

function getSiblingRefs(person: PersonDoc) {
  const refs = new Map<number, { source_person_id: number; name?: string }>();
  const groups = person.siblings_groups ?? [];

  for (const group of groups) {
    const legacyIds = (group as { sibling_ids?: unknown }).sibling_ids;
    if (Array.isArray(legacyIds)) {
      for (const id of legacyIds) {
        if (typeof id === "number" && !refs.has(id)) refs.set(id, { source_person_id: id });
      }
    }

    const siblings = (group as { siblings?: Array<{ source_person_id?: unknown; name?: unknown }> }).siblings;
    if (Array.isArray(siblings)) {
      for (const sibling of siblings) {
        if (typeof sibling?.source_person_id === "number") {
          refs.set(sibling.source_person_id, {
            source_person_id: sibling.source_person_id,
            name: typeof sibling.name === "string" ? sibling.name : undefined,
          });
        }
      }
    }
  }

  return Array.from(refs.values());
}

export async function allocateNextPersonId() {
  const counters = await countersCollection();
  const updated = await counters.findOneAndUpdate(
    { _id: "abtirsi.people" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );

  if (!updated?.seq) {
    throw new Error("Failed to allocate source_person_id");
  }

  return updated.seq;
}

export async function createPersonDocument(payload: Partial<PersonDoc>) {
  const nextId = await allocateNextPersonId();
  return {
    source: "abtirsi" as const,
    source_person_id: nextId,
    name: payload.name,
    names: payload.names ?? [],
    notes_text: payload.notes_text ?? "",
    father_id: payload.father_id ?? null,
    father_name: payload.father_name ?? null,
    mother_id: payload.mother_id ?? null,
    mother_name: payload.mother_name ?? null,
    children_group: [],
    siblings_groups: [],
  };
}

export function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  if (!before || !after) return after;

  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const previous = before[key];
    const next = after[key];

    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      diff[key] = { before: previous, after: next };
    }
  }

  return diff;
}

export async function applyPersonPatch(
  sourcePersonId: number,
  patch: Record<string, unknown>,
) {
  const people = await peopleCollection();
  const filter: Filter<PersonDoc> = {
    source: "abtirsi",
    source_person_id: sourcePersonId,
  };

  const before = await people.findOne(filter);
  if (!before) {
    throw new Error(`Person ${sourcePersonId} not found`);
  }

  const after = clone(before) as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    after[key] = value;
  }

  await people.updateOne(filter, { $set: patch });

  return {
    before,
    after,
    diff: computeDiff(before as Record<string, unknown>, after),
  };
}

export async function attachParent(
  sourcePersonId: number,
  parentType: "father" | "mother",
  parent_id?: number,
  parent_name?: string,
) {
  const fieldId = `${parentType}_id`;
  const fieldName = `${parentType}_name`;
  const patch: Record<string, unknown> = {
    [fieldId]: parent_id ?? null,
    [fieldName]: parent_name ?? null,
  };

  return applyPersonPatch(sourcePersonId, patch);
}

export async function attachChild(
  sourcePersonId: number,
  childId: number,
  motherId?: number | null,
  motherName?: string | null,
  label?: string | null,
) {
  const people = await peopleCollection();
  const person = await people.findOne({
    source: "abtirsi",
    source_person_id: sourcePersonId,
  });

  if (!person) throw new Error("Target person not found");

  const childrenGroups: ChildGroup[] = clone(person.children_group ?? []);

  const groupIndex = childrenGroups.findIndex((group) => {
    const sameMotherId = (group.mother_id ?? null) === (motherId ?? null);
    const sameMotherName = (group.mother_name ?? null) === (motherName ?? null);
    const sameLabel = (group.label ?? null) === (label ?? null);
    return sameMotherId && sameMotherName && sameLabel;
  });

  const group: ChildGroup =
    groupIndex >= 0
      ? childrenGroups[groupIndex]
      : {
          mother_id: motherId ?? null,
          mother_name: motherName ?? null,
          label: label ?? null,
          children_ids: [],
        };

  const childIds = new Set(group.children_ids ?? []);
  childIds.add(childId);
  group.children_ids = Array.from(childIds);

  if (groupIndex >= 0) childrenGroups[groupIndex] = group;
  else childrenGroups.push(group);

  return applyPersonPatch(sourcePersonId, { children_group: childrenGroups });
}

export async function insertPerson(person: PersonDoc) {
  const people = await peopleCollection();
  await people.insertOne(person);
  return person;
}

export async function getPersonByMongoId(editTargetId: ObjectId) {
  const people = await peopleCollection();
  return people.findOne({ _id: editTargetId });
}
