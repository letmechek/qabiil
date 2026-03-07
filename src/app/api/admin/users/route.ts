import bcrypt from "bcrypt";
import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import { usersCollection } from "@/lib/db/collections";
import { fail, ok, parseBody } from "@/lib/http";
import { hasRole } from "@/lib/security/authorize";
import { AdminCreateUserSchema } from "@/lib/validation/schemas";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return fail("Unauthorized", 401);
  if (!hasRole(session, ["ADMIN"])) return fail("Admin access required", 403);

  const users = await usersCollection();
  const list = await users
    .find(
      {},
      {
        projection: {
          password_hash: 0,
        },
      },
    )
    .sort({ created_at: -1 })
    .toArray();

  return ok({ users: list });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return fail("Unauthorized", 401);
  if (!hasRole(session, ["ADMIN"])) return fail("Admin access required", 403);

  const body = await parseBody(req, AdminCreateUserSchema);
  const users = await usersCollection();

  const existing = await users.findOne({ email: body.email.toLowerCase() });
  if (existing) return fail("Email already exists", 409);

  const password_hash = await bcrypt.hash(body.password, 12);

  await users.insertOne({
    email: body.email.toLowerCase(),
    name: body.name,
    password_hash,
    roles: body.roles,
    lineage_permissions: body.lineage_permissions,
    is_active: body.is_active,
    created_at: new Date(),
    updated_at: new Date(),
  } as never);

  return ok({ success: true }, 201);
}
