import { NextResponse } from "next/server";

import type { Session } from "next-auth";

import { isPersonInLineage } from "@/lib/security/lineage";
import type { Role } from "@/lib/types";

export function hasRole(session: Session | null, allowed: Role[]) {
  if (!session?.user) return false;
  return session.user.roles.some((role) => allowed.includes(role));
}

export async function canAccessLineage(session: Session | null, personId: number) {
  if (!session?.user) return false;
  if (session.user.roles.includes("ADMIN")) return true;

  const permissions = session.user.lineage_permissions;
  if (permissions === "ALL") return true;
  if (!Array.isArray(permissions) || permissions.length === 0) return false;

  return isPersonInLineage(personId, permissions);
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
