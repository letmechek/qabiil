"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import type { Role } from "@/lib/types";

function can(roles: Role[], needed: Role[]) {
  return roles.some((role) => needed.includes(role));
}

export function AuthGateButton({
  children,
  requiredRoles,
  nextPath,
  href,
}: {
  children: string;
  requiredRoles: Role[];
  nextPath: string;
  href: string;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();

  return (
    <button
      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      onClick={() => {
        if (status !== "authenticated") {
          router.push(`/login?callbackUrl=${encodeURIComponent(nextPath)}`);
          return;
        }

        const roles = session.user.roles ?? [];
        if (!can(roles, requiredRoles)) {
          alert("You don't have permission. Request access from an administrator.");
          return;
        }

        router.push(href);
      }}
    >
      {children}
    </button>
  );
}
