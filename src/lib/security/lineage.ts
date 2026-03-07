import { peopleCollection } from "@/lib/db/collections";

const requestCache = new Map<string, boolean>();

export async function isPersonInLineage(
  targetId: number,
  rootIds: number[],
): Promise<boolean> {
  if (rootIds.includes(targetId)) return true;

  const cacheKey = `${targetId}:${rootIds.slice().sort((a, b) => a - b).join(",")}`;
  const cached = requestCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const people = await peopleCollection();
  const visited = new Set<number>();
  const queue: number[] = [targetId];

  while (queue.length) {
    const personId = queue.shift()!;
    if (visited.has(personId)) continue;
    visited.add(personId);

    if (rootIds.includes(personId)) {
      requestCache.set(cacheKey, true);
      return true;
    }

    const person = await people.findOne(
      { source: "abtirsi", source_person_id: personId },
      { projection: { father_id: 1, mother_id: 1, father: 1, mother: 1 } },
    );

    if (!person) continue;
    const fatherId =
      typeof person.father_id === "number"
        ? person.father_id
        : typeof person.father?.source_person_id === "number"
          ? person.father.source_person_id
          : null;

    const motherId =
      typeof person.mother_id === "number"
        ? person.mother_id
        : typeof person.mother?.source_person_id === "number"
          ? person.mother.source_person_id
          : null;

    if (typeof fatherId === "number") queue.push(fatherId);
    if (typeof motherId === "number") queue.push(motherId);
  }

  requestCache.set(cacheKey, false);
  return false;
}
