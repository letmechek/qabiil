import { DefaultSession } from "next-auth";

import type { LineagePermissions, Role } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roles: Role[];
      lineage_permissions: LineagePermissions;
      is_active: boolean;
    };
  }

  interface User {
    roles: Role[];
    lineage_permissions: LineagePermissions;
    is_active: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: Role[];
    lineage_permissions?: LineagePermissions;
    is_active?: boolean;
  }
}
