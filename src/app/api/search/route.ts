import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/http";
import { getDidYouMean, searchPeople, suggestPeopleNames } from "@/lib/services/search.service";
import { SearchQuerySchema } from "@/lib/validation/schemas";

function dedupeById<T extends { _id?: string }>(items: T[]) {
  const uniq = new Map<string, T>();
  for (const item of items) {
    const key = item._id ?? "";
    if (!key || uniq.has(key)) continue;
    uniq.set(key, item);
  }
  return Array.from(uniq.values());
}

export async function GET(req: NextRequest) {
  const suggestOnly = req.nextUrl.searchParams.get("suggest") === "true";
  const parsed = SearchQuerySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? "",
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return fail(parsed.error.message, 400);
  }

  if (suggestOnly) {
    const suggestions = dedupeById(
      await suggestPeopleNames(parsed.data.q, Math.min(parsed.data.limit, 12)),
    );
    return ok({ query: parsed.data.q, suggestions });
  }

  const results = dedupeById(await searchPeople(parsed.data.q, parsed.data.limit));
  const suggestions = dedupeById(
    await suggestPeopleNames(parsed.data.q, Math.min(parsed.data.limit, 8)),
  );
  const didYouMean = await getDidYouMean(parsed.data.q, results.length);

  return ok({ query: parsed.data.q, results, suggestions, didYouMean });
}
