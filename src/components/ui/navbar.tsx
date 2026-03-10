"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function Navbar() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && Boolean(session?.user);

  return (
    <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="container-shell flex items-center justify-between py-3">
        <Link
          href="/"
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400"
        >
          Home
        </Link>

        {isLoggedIn ? (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
          >
            Logout
          </button>
        ) : null}
      </div>
    </header>
  );
}
