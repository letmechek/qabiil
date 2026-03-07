import { z } from "zod";

import { EDIT_ACTIONS, EDIT_STATUSES, ROLES } from "@/lib/types";

export const SearchQuerySchema = z.object({
  q: z.string().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const RelativesQuerySchema = z.object({
  ancestorsDepth: z.coerce.number().int().min(0).max(6).default(2),
  descendantsDepth: z.coerce.number().int().min(0).max(6).default(2),
});

export const PersonPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  names: z.array(z.string().min(1).max(200)).max(20).optional(),
  notes_text: z.string().max(20000).optional(),
  father_id: z.number().int().positive().nullable().optional(),
  father_name: z.string().max(200).nullable().optional(),
  mother_id: z.number().int().positive().nullable().optional(),
  mother_name: z.string().max(200).nullable().optional(),
  siblings_groups: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        sibling_ids: z.array(z.number().int().positive()).max(200),
      }),
    )
    .max(50)
    .optional(),
});

export const AttachParentSchema = z.object({
  parentType: z.enum(["father", "mother"]),
  parent_id: z.number().int().positive().optional(),
  parent_name: z.string().max(200).optional(),
});

export const AttachChildSchema = z.object({
  child_id: z.number().int().positive(),
  mother_id: z.number().int().positive().nullable().optional(),
  mother_name: z.string().max(200).nullable().optional(),
  group_label: z.string().max(200).nullable().optional(),
});

export const CreatePersonSchema = z.object({
  name: z.string().min(1).max(200),
  names: z.array(z.string().min(1).max(200)).max(20).default([]),
  notes_text: z.string().max(20000).optional(),
  father_id: z.number().int().positive().nullable().optional(),
  father_name: z.string().max(200).nullable().optional(),
  mother_id: z.number().int().positive().nullable().optional(),
  mother_name: z.string().max(200).nullable().optional(),
});

export const EditSubmissionSchema = z.object({
  action: z.enum(EDIT_ACTIONS),
  target_source_person_id: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
  applyImmediately: z.boolean().optional(),
});

export const EditListQuerySchema = z.object({
  status: z.enum(EDIT_STATUSES).default("PENDING_REVIEW"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const RejectSchema = z.object({
  reason: z.string().min(2).max(1000).optional(),
});

export const UserUpsertSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  roles: z.array(z.enum(ROLES)).min(1),
  lineage_permissions: z.union([z.literal("ALL"), z.array(z.number().int().positive())]),
  is_active: z.boolean(),
});

export const AdminCreateUserSchema = UserUpsertSchema.extend({
  password: z.string().min(8).max(200),
});
