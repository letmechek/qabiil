"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type EditItem = {
  _id: string;
  action: string;
  target_source_person_id: number;
  diff: Record<string, unknown> | null;
  created_at: string;
};

export default function RequestsPage() {
  const { data: session, status } = useSession();
  const canReview =
    session?.user.roles?.includes("REVIEWER") || session?.user.roles?.includes("ADMIN");

  const [items, setItems] = useState<EditItem[]>([]);

  async function load() {
    const res = await fetch("/api/edits?status=PENDING_REVIEW&limit=100");
    const data = await res.json();
    setItems(data.edits ?? []);
  }

  useEffect(() => {
    if (!canReview) return;
    void fetch("/api/edits?status=PENDING_REVIEW&limit=100")
      .then((res) => res.json())
      .then((data) => setItems(data.edits ?? []));
  }, [canReview]);

  async function approve(id: string) {
    await fetch(`/api/edits/${id}/approve`, { method: "POST" });
    load();
  }

  async function reject(id: string) {
    await fetch(`/api/edits/${id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Rejected by reviewer" }),
    });
    load();
  }

  if (status === "loading") return <main className="container-shell py-6">Loading...</main>;

  if (!canReview) {
    return (
      <main className="container-shell py-6">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">You don&apos;t have permission</h1>
          <p className="mt-2 text-sm text-slate-600">Request REVIEWER access from an administrator.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container-shell py-6">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">Pending edit requests</h1>
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item._id} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold">
                {item.action} on #{item.target_source_person_id}
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(item.diff, null, 2)}
              </pre>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={() => approve(item._id)}>
                  Approve
                </button>
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm"
                  onClick={() => reject(item._id)}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
