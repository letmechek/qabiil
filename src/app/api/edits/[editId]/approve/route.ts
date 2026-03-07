import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import { fail, ok } from "@/lib/http";
import { approveEdit, getEditById } from "@/lib/services/edits.service";
import { canAccessLineage, hasRole } from "@/lib/security/authorize";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ editId: string }> },
) {
  const session = await getSession();
  if (!session?.user) return fail("Unauthorized", 401);
  if (!hasRole(session, ["REVIEWER", "ADMIN"])) return fail("Insufficient role", 403);

  const { editId } = await context.params;
  const edit = await getEditById(editId);
  if (!edit) return fail("Edit not found", 404);
  const allowed = await canAccessLineage(session, edit.target_source_person_id);
  if (!allowed) return fail("Lineage scope violation", 403);

  try {
    const result = await approveEdit(editId, session.user.id);
    return ok({ edit: result });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to approve", 400);
  }
}
