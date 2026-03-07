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
) {
  const nodes = new Map<number, PersonDoc>();
  const edges: Array<{ from: number; to: number; type: "PARENT" | "CHILD" }> = [];
  const edgeKeys = new Set<string>();

  const start = await getPersonById(sourcePersonId);
  if (!start) return { nodes: [], edges: [] };

  nodes.set(start.source_person_id, start);
  const startParentIds = [getParentId(start, "father"), getParentId(start, "mother")].filter(
    (id): id is number => typeof id === "number",
  );

  const ancestorQueue: Array<{ id: number; depth: number }> = [{
    id: sourcePersonId,
    depth: 0,
  }];

  while (ancestorQueue.length) {
    const { id, depth } = ancestorQueue.shift()!;
    if (depth >= ancestorsDepth) continue;

    const person = nodes.get(id) ?? (await getPersonById(id));
    if (!person) continue;

    const parentIds = [getParentId(person, "father"), getParentId(person, "mother")];
    for (const parentId of parentIds) {
      if (typeof parentId !== "number") continue;
      if (parentId === id) continue;
      const parent = await getPersonById(parentId);
      if (!parent) continue;
      nodes.set(parent.source_person_id, parent);
      const edgeKey = `${parent.source_person_id}->${id}`;
      if (!edgeKeys.has(edgeKey)) {
        edges.push({ from: parent.source_person_id, to: id, type: "PARENT" });
        edgeKeys.add(edgeKey);
      }
      ancestorQueue.push({ id: parent.source_person_id, depth: depth + 1 });
    }
  }

  const descendantQueue: Array<{ id: number; depth: number }> = [{
    id: sourcePersonId,
    depth: 0,
  }];

  while (descendantQueue.length) {
    const { id, depth } = descendantQueue.shift()!;
    if (depth >= descendantsDepth) continue;

    const person = nodes.get(id) ?? (await getPersonById(id));
    if (!person) continue;

    const childIds = getChildrenIds(person);
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

  const siblingIds = getSiblingIds(start);
  for (const siblingId of siblingIds) {
    if (siblingId === sourcePersonId) continue;
    const sibling = await getPersonById(siblingId);
    if (!sibling) continue;
    nodes.set(sibling.source_person_id, sibling);

    if (startParentIds.length) {
      for (const parentId of startParentIds) {
        const edgeKey = `${parentId}->${sibling.source_person_id}`;
        if (!edgeKeys.has(edgeKey)) {
          edges.push({ from: parentId, to: sibling.source_person_id, type: "CHILD" });
          edgeKeys.add(edgeKey);
        }
      }
      continue;
    }

    const siblingEdge = `${sourcePersonId}->${sibling.source_person_id}`;
    if (!edgeKeys.has(siblingEdge)) {
      edges.push({ from: sourcePersonId, to: sibling.source_person_id, type: "CHILD" });
      edgeKeys.add(siblingEdge);
    }
  }

  return {
    nodes: Array.from(nodes.values()).map((node) => ({
      source_person_id: node.source_person_id,
      name: node.name ?? node.names?.[0] ?? null,
    })),
    edges,
  };
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

function getSiblingIds(person: PersonDoc) {
  const ids = new Set<number>();
  const groups = person.siblings_groups ?? [];

  for (const group of groups) {
    const legacyIds = (group as { sibling_ids?: unknown }).sibling_ids;
    if (Array.isArray(legacyIds)) {
      for (const id of legacyIds) {
        if (typeof id === "number") ids.add(id);
      }
    }

    const refs = (group as { siblings?: Array<{ source_person_id?: unknown }> }).siblings;
    if (Array.isArray(refs)) {
      for (const sibling of refs) {
        if (typeof sibling?.source_person_id === "number") {
          ids.add(sibling.source_person_id);
        }
      }
    }
  }

  return Array.from(ids);
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
