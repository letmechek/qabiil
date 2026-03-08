import { peopleCollection } from "@/lib/db/collections";

type ClanCategory = "Darod" | "Hawiye" | "Dir" | "Rahanweyn";

type SearchPerson = {
  _id: { toString(): string };
  source_person_id: number;
  name?: string;
  names?: string[];
  father_name?: string | null;
  mother_name?: string | null;
  genealogy?: Array<{ index?: number; name?: string | null }> | null;
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
  const classification = classifyGenealogy(person.genealogy ?? []);
  return {
    _id: person._id.toString(),
    id: person.source_person_id,
    name: person.name ?? person.names?.[0] ?? `Person ${person.source_person_id}`,
    lineage_first_name: person.genealogy?.[0]?.name ?? null,
    father_name: person.father_name ?? null,
    mother_name: person.mother_name ?? null,
    clanCategory: classification.clanCategory,
    matchedAncestor: classification.matchedAncestor,
    classificationReason: classification.classificationReason,
  };
}

function dedupeByObjectId<T extends { _id: { toString(): string } }>(docs: T[]) {
  const uniq = new Map<string, T>();
  for (const doc of docs) {
    const key = doc._id.toString();
    if (!uniq.has(key)) uniq.set(key, doc);
  }
  return Array.from(uniq.values());
}

function normalizeGenealogyEntries(genealogy: Array<{ index?: number; name?: string | null }>) {
  const out: Array<{ index: number; originalName: string; normalizedName: string }> = [];
  const seen = new Set<string>();

  genealogy
    .filter((entry) => entry && typeof entry.name === "string")
    .sort((a, b) => Number(a.index ?? 9999) - Number(b.index ?? 9999))
    .forEach((entry, idx) => {
      const originalName = String(entry.name ?? "").trim();
      const normalizedName = normalizeName(originalName);
      const index = Number(entry.index ?? idx + 1);
      if (!normalizedName || seen.has(normalizedName)) return;
      seen.add(normalizedName);
      out.push({ index, originalName, normalizedName });
    });

  return out;
}

const CLAN_MARKERS: Record<ClanCategory, string[]> = {
  Darod: ["darod", "jaberti", "kablalah", "awrtable", "sade", "marehan", "mohamud saleban"],
  Hawiye: ["hawiye", "gorgate", "hil", "samale", "abgaal", "habar gidir", "duduble", "murusade"],
  Dir: ["dir", "irir", "gadabuursi", "issa", "bimaal", "surre"],
  Rahanweyn: ["rahanweyn", "digil", "mirifle", "hadame", "eli", "tunni"],
};

function classifyGenealogy(genealogy: Array<{ index?: number; name?: string | null }>) {
  const uniqueEntries = normalizeGenealogyEntries(genealogy);
  const matches: Array<{ category: ClanCategory; index: number; matchedAncestor: string }> = [];

  for (const entry of uniqueEntries) {
    for (const category of Object.keys(CLAN_MARKERS) as ClanCategory[]) {
      if (CLAN_MARKERS[category].some((marker) => entry.normalizedName.includes(marker))) {
        matches.push({
          category,
          index: entry.index,
          matchedAncestor: entry.originalName,
        });
      }
    }
  }

  if (!matches.length) {
    return {
      clanCategory: "Unknown" as const,
      matchedAncestor: null,
      classificationReason: "no_markers",
    };
  }

  matches.sort((a, b) => a.index - b.index);
  const earliest = matches[0];
  const matchesAtEarliest = matches.filter((m) => m.index === earliest.index);
  const earliestCategories = new Set(matchesAtEarliest.map((m) => m.category));
  const hasConflictAtEarliest = earliestCategories.size > 1;

  if (hasConflictAtEarliest) {
    return {
      clanCategory: "Unknown" as const,
      matchedAncestor: null,
      classificationReason: "conflicting_markers",
    };
  }

  const conflictingAtSameIndex = matchesAtEarliest.some((m) => m.category !== earliest.category);
  if (conflictingAtSameIndex) {
    return {
      clanCategory: "Unknown" as const,
      matchedAncestor: null,
      classificationReason: "conflicting_markers",
    };
  }

  const categoriesInAllMatches = new Set(matches.map((m) => m.category));
  const reason =
    categoriesInAllMatches.size > 1 ? "earliest_reliable_marker" : "earliest_reliable_marker";

  return {
    clanCategory: earliest.category,
    matchedAncestor: earliest.matchedAncestor,
    classificationReason: reason,
  };
}

export async function searchPeople(query: string, limit = 20) {
  const people = await peopleCollection();
  const q = query.trim();

  if (!q) {
    const latestRaw = await people
      .find(
        { source: "abtirsi" },
        {
          projection: {
            _id: 1,
            source_person_id: 1,
            name: 1,
            names: 1,
            genealogy: 1,
            father_name: 1,
            mother_name: 1,
          },
        },
      )
      .sort({ source_person_id: -1 })
      .limit(limit * 2)
      .toArray();
    const latest = dedupeByObjectId(latestRaw).slice(0, limit);

    return latest.map(mapResult);
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  const textMatchesRaw = await people
    .find(
      {
        source: "abtirsi",
        $or: [{ name: regex }, { names: regex }, { notes_text: regex }],
      },
      {
        projection: {
          _id: 1,
          source_person_id: 1,
          name: 1,
          names: 1,
          genealogy: 1,
          father_name: 1,
          mother_name: 1,
        },
      },
    )
    .limit(limit * 3)
    .toArray();
  const textMatches = dedupeByObjectId(textMatchesRaw).slice(0, limit);

  return textMatches.map(mapResult);
}

export async function suggestPeopleNames(query: string, limit = 8) {
  const people = await peopleCollection();
  const q = query.trim();

  const projection = {
    _id: 1,
    source_person_id: 1,
    name: 1,
    names: 1,
    genealogy: 1,
  };

  const docsRaw = q
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
        .limit(40)
        .toArray();

  const docs = dedupeByObjectId(docsRaw).slice(0, limit);
  const mapped = docs.map(mapResult);

  return mapped;
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
