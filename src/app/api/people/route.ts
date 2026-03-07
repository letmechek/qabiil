import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import { fail, ok, parseBody } from "@/lib/http";
import { canAccessLineage, hasRole } from "@/lib/security/authorize";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { submitEdit } from "@/lib/services/edits.service";
import { CreatePersonSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for");
  const gate = rateLimit(clientKey(ip, "write"), 20, 60_000);
  if (!gate.allowed) return fail("Too many requests", 429);

  const session = await getSession();
  if (!session?.user) return fail("Unauthorized", 401);
  if (!hasRole(session, ["EDITOR", "ADMIN"])) return fail("Insufficient role", 403);

  const body = await parseBody(req, CreatePersonSchema);
  const applyImmediately =
    session.user.roles.includes("ADMIN") && req.nextUrl.searchParams.get("applyImmediately") === "true";

  let scopeAnchor = null as number | null;
  if (typeof body.father_id === "number") scopeAnchor = body.father_id;
  if (typeof body.mother_id === "number") scopeAnchor = body.mother_id;

  if (!session.user.roles.includes("ADMIN")) {
    if (!scopeAnchor) {
      return fail("Non-admin creation requires father_id or mother_id within your lineage scope", 403);
    }

    if (!(await canAccessLineage(session, scopeAnchor))) {
      return fail("Lineage scope violation", 403);
    }
  }

  const result = await submitEdit({
    actorUserId: session.user.id,
    action: "CREATE_PERSON",
    targetSourcePersonId: scopeAnchor ?? 1,
    payload: body,
    applyImmediately,
  });

  return ok(result, applyImmediately ? 201 : 202);
}
