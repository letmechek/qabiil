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

  const start = await getPersonById(sourcePersonId);
  if (!start) return { nodes: [], edges: [], lineage: [] };

  nodes.set(start.source_person_id, start);
  const lineage = getLineageEntries(start);
  const chainIds = getGenealogyChainIds(start);

  for (const id of chainIds) {
    const person = id === sourcePersonId ? start : await getPersonById(id);
    if (person) nodes.set(id, person);
  }

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
    const descendantQueue: Array<{ id: number; depth: number }> = [{
      id: sourcePersonId,
      depth: 0,
    }];

    while (descendantQueue.length) {
      const { id, depth } = descendantQueue.shift()!;
      if (depth >= descendantsDepth) continue;

      const person = nodes.get(id) ?? (await getPersonById(id));
      if (!person) continue;

      const childIds = await getChildrenIdsForPerson(id, person);
      if (!childIds.length) continue;

      for (const childId of childIds) {
        if (childId === id) continue;
        const child = await getPersonById(childId);
        if (!child) continue;
        nodes.set(child.source_person_id, child);
        const edgeKey = `${id}->${child.source_person_id}`;
        if (!edgeKeys.has(edgeKey)) {
          edges.push({ from: id, to: child.source_person_id, type: "CHILD" });
          edgeKeys.add(edgeKey);
        }
        descendantQueue.push({ id: child.source_person_id, depth: depth + 1 });
      }
    }
  }

  if (includeSiblings) {
    const siblingRefs = getSiblingRefs(start);
    for (const siblingRef of siblingRefs) {
      if (siblingRef.source_person_id === sourcePersonId) continue;
      const sibling = await getPersonById(siblingRef.source_person_id);
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
  const explicitId = person[`${side}_id` as keyof PersonDoc];
  if (typeof explicitId === "number") return explicitId;

  const ref = person[side] as { source_person_id?: unknown } | null | undefined;
  if (typeof ref?.source_person_id === "number") return ref.source_person_id;

  return null;
}

function getChildrenIds(person: PersonDoc) {
  const ids = new Set<number>();
  const legacyGroups = person.children_group ?? [];
  const groupedChildren = person.children_groups ?? [];

  for (const group of legacyGroups) {
    for (const childId of group.children_ids ?? []) {
      if (typeof childId === "number") ids.add(childId);
    }
  }

  for (const group of groupedChildren) {
    for (const child of group.children ?? []) {
      if (typeof child?.source_person_id === "number") {
        ids.add(child.source_person_id);
      }
    }
  }

  return Array.from(ids);
}

async function getChildrenIdsForPerson(sourcePersonId: number, person?: PersonDoc) {
  const ids = new Set<number>();

  if (person) {
    for (const id of getChildrenIds(person)) ids.add(id);
  }

  const people = await peopleCollection();
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
  const person = await getPersonById(sourcePersonId);
  const ids = await getChildrenIdsForPerson(sourcePersonId, person ?? undefined);
  const people = await Promise.all(ids.map((id) => getPersonById(id)));
  const out = people
    .filter((child): child is NonNullable<typeof child> => Boolean(child))
    .map((child) => ({
      source_person_id: child.source_person_id,
      name: child.name ?? child.names?.[0] ?? `Person ${child.source_person_id}`,
    }));

  return out.sort((a, b) => a.name.localeCompare(b.name));
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
