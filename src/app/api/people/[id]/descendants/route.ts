import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/http";
import { getDirectDescendants } from "@/lib/services/people.service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const personId = Number(id);

  if (!Number.isInteger(personId) || personId < 1) {
    return fail("Invalid person id", 400);
  }

  const descendants = await getDirectDescendants(personId);
  return ok({ descendants });
}
