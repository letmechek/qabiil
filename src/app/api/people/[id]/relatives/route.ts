import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/http";
import { getRelativesGraph } from "@/lib/services/people.service";
import { RelativesQuerySchema } from "@/lib/validation/schemas";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const personId = Number(id);

  if (!Number.isInteger(personId) || personId < 1) {
    return fail("Invalid person id", 400);
  }

  const parsed = RelativesQuerySchema.safeParse({
    ancestorsDepth: req.nextUrl.searchParams.get("ancestorsDepth") ?? undefined,
    descendantsDepth: req.nextUrl.searchParams.get("descendantsDepth") ?? undefined,
  });

  if (!parsed.success) return fail(parsed.error.message, 400);

  const graph = await getRelativesGraph(
    personId,
    parsed.data.ancestorsDepth,
    parsed.data.descendantsDepth,
  );

  return ok(graph);
}
