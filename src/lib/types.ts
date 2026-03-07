import { ObjectId } from "mongodb";

export const ROLES = ["USER", "EDITOR", "REVIEWER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const EDIT_ACTIONS = [
  "CREATE_PERSON",
  "UPDATE_PERSON",
  "ATTACH_CHILD",
  "ATTACH_PARENT",
  "MERGE_PERSON",
] as const;
export type EditAction = (typeof EDIT_ACTIONS)[number];

export const EDIT_STATUSES = ["APPLIED", "PENDING_REVIEW", "REJECTED"] as const;
export type EditStatus = (typeof EDIT_STATUSES)[number];

export type LineagePermissions = number[] | "ALL";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  password_hash: string;
  roles: Role[];
  lineage_permissions: LineagePermissions;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CounterDoc {
  _id: "abtirsi.people";
  seq: number;
}

export interface ChildGroup {
  mother_id?: number | null;
  mother_name?: string | null;
  label?: string | null;
  children_ids?: number[];
  mother?: ParentRef | null;
  children?: ParentRef[];
}

export interface SiblingGroup {
  label: string;
  sibling_ids?: number[];
  siblings?: ParentRef[];
}

export interface PersonDoc {
  _id?: ObjectId;
  source: "abtirsi";
  source_person_id: number;
  name?: string;
  names?: string[];
  notes_text?: string;
  notes_html?: string;
  father_id?: number | null;
  father_name?: string | null;
  mother_id?: number | null;
  mother_name?: string | null;
  father?: ParentRef | null;
  mother?: ParentRef | null;
  children_group?: ChildGroup[];
  children_groups?: ChildGroup[];
  siblings_groups?: SiblingGroup[];
  [key: string]: unknown;
}

export interface ParentRef {
  source_person_id?: number;
  name?: string;
}

export interface EditDoc {
  _id: ObjectId;
  actor_user_id: ObjectId;
  action: EditAction;
  target_source_person_id: number;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  status: EditStatus;
  created_at: Date;
  reviewed_at?: Date;
  reviewed_by?: ObjectId;
  reject_reason?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  lineage_permissions: LineagePermissions;
  is_active: boolean;
}
