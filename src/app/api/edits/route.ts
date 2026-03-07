import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import { fail, ok, parseBody } from "@/lib/http";
import { canAccessLineage, hasRole } from "@/lib/security/authorize";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { listEdits, submitEdit } from "@/lib/services/edits.service";
import {
  AttachChildSchema,
  AttachParentSchema,
  EditListQuerySchema,
  EditSubmissionSchema,
  PersonPatchSchema,
} from "@/lib/validation/schemas";

function validateActionPayload(action: string, payload: Record<string, unknown>) {
  if (action === "UPDATE_PERSON") return PersonPatchSchema.parse(payload);
  if (action === "ATTACH_PARENT") return AttachParentSchema.parse(payload);
  if (action === "ATTACH_CHILD") return AttachChildSchema.parse(payload);
  return payload;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return fail("Unauthorized", 401);
  if (!hasRole(session, ["REVIEWER", "ADMIN"])) return fail("Insufficient role", 403);

  const parsed = EditListQuerySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) return fail(parsed.error.message, 400);

  const edits = await listEdits(parsed.data.status, parsed.data.limit);
  if (session.user.roles.includes("ADMIN")) {
    return ok({ edits });
  }

  const scopedEdits = [];
  for (const edit of edits) {
    const allowed = await canAccessLineage(session, edit.target_source_person_id);
    if (allowed) scopedEdits.push(edit);
  }

  return ok({ edits: scopedEdits });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for");
  const gate = rateLimit(clientKey(ip, "write"), 20, 60_000);
  if (!gate.allowed) return fail("Too many requests", 429);

  const session = await getSession();
  if (!session?.user) return fail("Unauthorized", 401);
  if (!hasRole(session, ["EDITOR", "ADMIN"])) return fail("Insufficient role", 403);

  const parsed = await parseBody(req, EditSubmissionSchema);
  validateActionPayload(parsed.action, parsed.payload);

  const allowedLineage = await canAccessLineage(session, parsed.target_source_person_id);
  if (!allowedLineage) return fail("Lineage scope violation", 403);

  const applyImmediately =
    Boolean(parsed.applyImmediately) && session.user.roles.includes("ADMIN");

  const result = await submitEdit({
    actorUserId: session.user.id,
    action: parsed.action,
    targetSourcePersonId: parsed.target_source_person_id,
    payload: parsed.payload,
    applyImmediately,
  });

  return ok(result, applyImmediately ? 200 : 202);
}
