import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import { fail, ok, parseBody } from "@/lib/http";
import { submitEdit } from "@/lib/services/edits.service";
import { getPersonById } from "@/lib/services/people.service";
import { canAccessLineage, hasRole } from "@/lib/security/authorize";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { PersonPatchSchema } from "@/lib/validation/schemas";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const personId = Number(id);

  if (!Number.isInteger(personId) || personId < 1) {
    return fail("Invalid person id", 400);
  }

  const person = await getPersonById(personId);
  if (!person) return fail("Person not found", 404);

  return ok(person);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const personId = Number(id);

  if (!Number.isInteger(personId) || personId < 1) {
    return fail("Invalid person id", 400);
  }

  const ip = req.headers.get("x-forwarded-for");
  const gate = rateLimit(clientKey(ip, "write"), 30, 60_000);
  if (!gate.allowed) return fail("Too many requests", 429);

  const session = await getSession();
  if (!session?.user) return fail("Unauthorized", 401);
  if (!hasRole(session, ["ADMIN"])) return fail("Admin access required", 403);

  const body = await parseBody(req, PersonPatchSchema);
  const inScope = await canAccessLineage(session, personId);
  if (!inScope) return fail("Lineage scope violation", 403);

  const result = await submitEdit({
    actorUserId: session.user.id,
    action: "UPDATE_PERSON",
    targetSourcePersonId: personId,
    payload: body,
    applyImmediately: true,
  });

  return ok(result);
}
