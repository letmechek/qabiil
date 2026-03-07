"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function EditPersonPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const linkedTo = Number(searchParams.get("linkedTo"));
  const { data: session, status } = useSession();

  const isCreate = useMemo(() => id === "new", [id]);
  const canEdit =
    session?.user.roles?.includes("EDITOR") || session?.user.roles?.includes("ADMIN");

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (isCreate) {
      const payload: Record<string, unknown> = { name, notes_text: notes, names: [name] };
      if (Number.isInteger(linkedTo) && linkedTo > 0) {
        payload.father_id = linkedTo;
      }

      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMessage(res.ok ? "Create request submitted." : "Failed to submit create request.");
      return;
    }

    const res = await fetch("/api/edits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_PERSON",
        target_source_person_id: Number(id),
        payload: { name, notes_text: notes },
      }),
    });

    setMessage(res.ok ? "Edit request submitted for review." : "Failed to submit edit.");
  }

  if (status === "loading") return <main className="container-shell py-6">Loading...</main>;

  if (!canEdit) {
    return (
      <main className="container-shell py-6">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">You don&apos;t have permission</h1>
          <p className="mt-2 text-sm text-slate-600">Request EDITOR access from an administrator.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container-shell py-6">
      <section className="card max-w-2xl p-6">
        <h1 className="text-2xl font-bold">{isCreate ? "Add person" : `Suggest edit for #${id}`}</h1>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Name"
            required
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-40 w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Notes"
          />
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          <button className="btn-primary" type="submit">
            Submit for review
          </button>
        </form>
      </section>
    </main>
  );
}
