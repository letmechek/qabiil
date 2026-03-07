"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type AdminUser = {
  _id: string;
  email: string;
  name: string;
  roles: string[];
  lineage_permissions: number[] | "ALL";
  is_active: boolean;
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user.roles?.includes("ADMIN");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    if (!isAdmin) return;
    void fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []));
  }, [isAdmin]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        name,
        password,
        roles: ["EDITOR"],
        lineage_permissions: "ALL",
        is_active: true,
      }),
    });

    setEmail("");
    setName("");
    setPassword("");
    loadUsers();
  }

  if (status === "loading") return <main className="container-shell py-6">Loading...</main>;

  if (!isAdmin) {
    return (
      <main className="container-shell py-6">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">Admin only</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="container-shell py-6 space-y-4">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">User management</h1>
        <form className="mt-4 grid gap-2 md:grid-cols-4" onSubmit={onSubmit}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-xl border border-slate-300 px-3 py-2"
            required
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="rounded-xl border border-slate-300 px-3 py-2"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-xl border border-slate-300 px-3 py-2"
            required
          />
          <button className="btn-primary">Create editor</button>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="mt-3 space-y-2">
          {users.map((user) => (
            <article key={user._id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-medium">{user.name}</p>
              <p className="text-slate-600">{user.email}</p>
              <p className="text-slate-600">Roles: {user.roles.join(", ")}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
