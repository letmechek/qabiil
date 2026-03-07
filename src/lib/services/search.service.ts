import { peopleCollection } from "@/lib/db/collections";

type SearchPerson = {
  source_person_id: number;
  name?: string;
  names?: string[];
  father_name?: string | null;
  mother_name?: string | null;
  genealogy?: Array<{ name?: string | null }> | null;
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function mapResult(person: SearchPerson) {
  return {
    id: person.source_person_id,
    name: person.name ?? person.names?.[0] ?? `Person ${person.source_person_id}`,
    lineage_first_name: person.genealogy?.[0]?.name ?? null,
    father_name: person.father_name ?? null,
    mother_name: person.mother_name ?? null,
  };
}

export async function searchPeople(query: string, limit = 20) {
  const people = await peopleCollection();
  const q = query.trim();

  if (!q) {
    const latest = await people
      .find(
        { source: "abtirsi" },
        {
          projection: {
            source_person_id: 1,
            name: 1,
            names: 1,
            genealogy: { $slice: 1 },
            father_name: 1,
            mother_name: 1,
          },
        },
      )
      .sort({ source_person_id: -1 })
      .limit(limit)
      .toArray();

    return latest.map(mapResult);
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  const textMatches = await people
    .find(
      {
        source: "abtirsi",
        $or: [{ name: regex }, { names: regex }, { notes_text: regex }],
      },
      {
        projection: {
          source_person_id: 1,
          name: 1,
          names: 1,
          genealogy: { $slice: 1 },
          father_name: 1,
          mother_name: 1,
        },
      },
    )
    .limit(limit)
    .toArray();

  return textMatches.map(mapResult);
}

export async function suggestPeopleNames(query: string, limit = 8) {
  const people = await peopleCollection();
  const q = query.trim();

  const projection = {
    source_person_id: 1,
    name: 1,
    names: 1,
    genealogy: { $slice: 1 },
  };

  const docs = q
    ? await people
        .find(
          {
            source: "abtirsi",
            $or: [
              { name: new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i") },
              { names: new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i") },
              { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
            ],
          },
          { projection },
        )
        .limit(60)
        .toArray()
    : await people
        .find({ source: "abtirsi" }, { projection })
        .sort({ source_person_id: -1 })
        .limit(20)
        .toArray();

  const uniq = new Map<string, ReturnType<typeof mapResult>>();
  for (const doc of docs) {
    const mapped = mapResult(doc);
    const key = normalizeName(mapped.name);
    if (!key || uniq.has(key)) continue;
    uniq.set(key, mapped);
    if (uniq.size >= limit) break;
  }

  return Array.from(uniq.values());
}

export async function getDidYouMean(query: string, currentResultsCount: number) {
  const q = normalizeName(query);
  if (!q || currentResultsCount > 0) return null;

  const suggestions = await suggestPeopleNames(query, 30);
  if (!suggestions.length) return null;

  let best: { name: string; score: number } | null = null;
  const maxDistance = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;

  for (const candidate of suggestions) {
    const normalizedCandidate = normalizeName(candidate.name);
    if (!normalizedCandidate || normalizedCandidate === q) continue;
    if (normalizedCandidate[0] !== q[0]) continue;

    const score = levenshtein(q, normalizedCandidate.split(" ").slice(0, 3).join(" "));
    if (score > maxDistance) continue;

    if (!best || score < best.score) {
      best = { name: candidate.name, score };
    }
  }

  return best?.name ?? null;
}
