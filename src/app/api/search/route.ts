import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/http";
import { getDidYouMean, searchPeople, suggestPeopleNames } from "@/lib/services/search.service";
import { SearchQuerySchema } from "@/lib/validation/schemas";

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
    const suggestions = await suggestPeopleNames(parsed.data.q, Math.min(parsed.data.limit, 12));
    return ok({ query: parsed.data.q, suggestions });
  }

  const results = await searchPeople(parsed.data.q, parsed.data.limit);
  const suggestions = await suggestPeopleNames(parsed.data.q, Math.min(parsed.data.limit, 8));
  const didYouMean = await getDidYouMean(parsed.data.q, results.length);

  return ok({ query: parsed.data.q, results, suggestions, didYouMean });
}
