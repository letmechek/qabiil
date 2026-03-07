import { ObjectId } from "mongodb";

import { editsCollection } from "@/lib/db/collections";
import {
  applyPersonPatch,
  attachChild,
  attachParent,
  computeDiff,
  createPersonDocument,
  getPersonById,
  insertPerson,
} from "@/lib/services/people.service";
import type { EditAction, EditStatus, PersonDoc } from "@/lib/types";

type MutationResult = {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  targetId: number;
};

async function executeAction(
  action: EditAction,
  targetId: number,
  payload: Record<string, unknown>,
): Promise<MutationResult> {
  if (action === "CREATE_PERSON") {
    const created = await createPersonDocument(payload as Partial<PersonDoc>);
    await insertPerson(created);
    return {
      before: null,
      after: created,
      diff: created,
      targetId: created.source_person_id,
    };
  }

  if (action === "UPDATE_PERSON") {
    const result = await applyPersonPatch(targetId, payload);
    return { ...result, targetId };
  }

  if (action === "ATTACH_PARENT") {
    const parentType = String(payload.parentType) as "father" | "mother";
    const parentId =
      typeof payload.parent_id === "number" ? (payload.parent_id as number) : undefined;
    const parentName =
      typeof payload.parent_name === "string" ? (payload.parent_name as string) : undefined;
    const result = await attachParent(targetId, parentType, parentId, parentName);
    return { ...result, targetId };
  }

  if (action === "ATTACH_CHILD") {
    if (typeof payload.child_id !== "number") {
      throw new Error("child_id is required");
    }

    const result = await attachChild(
      targetId,
      payload.child_id as number,
      typeof payload.mother_id === "number" ? (payload.mother_id as number) : null,
      typeof payload.mother_name === "string" ? (payload.mother_name as string) : null,
      typeof payload.group_label === "string" ? (payload.group_label as string) : null,
    );

    return { ...result, targetId };
  }

  if (action === "MERGE_PERSON") {
    throw new Error("MERGE_PERSON is not implemented in scaffold");
  }

  throw new Error(`Unsupported action: ${action}`);
}

export async function createEditLog(params: {
  actorUserId: string;
  action: EditAction;
  targetSourcePersonId: number;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  status: EditStatus;
}) {
  const edits = await editsCollection();

  const doc = {
    actor_user_id: new ObjectId(params.actorUserId),
    action: params.action,
    target_source_person_id: params.targetSourcePersonId,
    before: params.before,
    after: params.after,
    diff: params.diff,
    status: params.status,
    created_at: new Date(),
  };

  const result = await edits.insertOne(doc as never);
  return { ...doc, _id: result.insertedId };
}

export async function submitEdit(params: {
  actorUserId: string;
  action: EditAction;
  targetSourcePersonId: number;
  payload: Record<string, unknown>;
  applyImmediately: boolean;
}) {
  if (params.applyImmediately) {
    const mutation = await executeAction(
      params.action,
      params.targetSourcePersonId,
      params.payload,
    );

    const appliedLog = await createEditLog({
      actorUserId: params.actorUserId,
      action: params.action,
      targetSourcePersonId: mutation.targetId,
      before: mutation.before,
      after: mutation.after,
      diff: mutation.diff,
      status: "APPLIED",
    });

    return { status: "APPLIED" as const, edit: appliedLog };
  }

  const existing = await getPersonById(params.targetSourcePersonId);
  const before = existing ? (JSON.parse(JSON.stringify(existing)) as Record<string, unknown>) : null;
  const after = before
    ? ({ ...before, ...params.payload } as Record<string, unknown>)
    : (params.payload as Record<string, unknown>);

  const pendingLog = await createEditLog({
    actorUserId: params.actorUserId,
    action: params.action,
    targetSourcePersonId: params.targetSourcePersonId,
    before,
    after,
    diff: computeDiff(before, after),
    status: "PENDING_REVIEW",
  });

  return { status: "PENDING_REVIEW" as const, edit: pendingLog };
}

export async function listEdits(status: EditStatus, limit: number) {
  const edits = await editsCollection();
  return edits.find({ status }).sort({ created_at: -1 }).limit(limit).toArray();
}

export async function getEditById(editId: string) {
  const edits = await editsCollection();
  return edits.findOne({ _id: new ObjectId(editId) });
}

export async function approveEdit(editId: string, reviewerUserId: string) {
  const edits = await editsCollection();
  const _id = new ObjectId(editId);

  const edit = await edits.findOne({ _id });
  if (!edit) throw new Error("Edit not found");
  if (edit.status !== "PENDING_REVIEW") throw new Error("Edit is no longer pending");

  const mutation = await executeAction(
    edit.action,
    edit.target_source_person_id,
    edit.after ?? {},
  );

  await edits.updateOne(
    { _id, status: "PENDING_REVIEW" },
    {
      $set: {
        status: "APPLIED",
        before: mutation.before,
        after: mutation.after,
        diff: mutation.diff,
        reviewed_at: new Date(),
        reviewed_by: new ObjectId(reviewerUserId),
      },
    },
  );

  return { ...edit, status: "APPLIED" as const };
}

export async function rejectEdit(editId: string, reviewerUserId: string, reason?: string) {
  const edits = await editsCollection();
  const _id = new ObjectId(editId);

  const edit = await edits.findOne({ _id });
  if (!edit) throw new Error("Edit not found");
  if (edit.status !== "PENDING_REVIEW") throw new Error("Edit is no longer pending");

  const update: {
    status: "REJECTED";
    reviewed_at: Date;
    reviewed_by: ObjectId;
    reject_reason?: string;
  } = {
    status: "REJECTED",
    reviewed_at: new Date(),
    reviewed_by: new ObjectId(reviewerUserId),
  };

  if (reason) update.reject_reason = reason;

  await edits.updateOne(
    { _id, status: "PENDING_REVIEW" },
    {
      $set: update,
    },
  );

  return { ...edit, status: "REJECTED" as const };
}
