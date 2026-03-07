import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthGateButton } from "@/components/ui/auth-gate-button";
import { getPersonById } from "@/lib/services/people.service";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  const person = await getPersonById(personId);

  if (!person) notFound();
  const fatherDisplay =
    person.father_name ??
    person.father?.name ??
    person.father_id ??
    person.father?.source_person_id ??
    "Unknown";
  const motherDisplay =
    person.mother_name ??
    person.mother?.name ??
    person.mother_id ??
    person.mother?.source_person_id ??
    "Unknown";

  return (
    <main className="container-shell py-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{person.name ?? person.names?.[0] ?? `Person ${person.source_person_id}`}</h1>
            <p className="mt-1 text-sm text-slate-500">Source ID: {person.source_person_id}</p>
          </div>
          <div className="flex gap-2">
            <AuthGateButton requiredRoles={["EDITOR", "ADMIN"]} nextPath={`/p/${id}`} href={`/edit/p/${id}`}>
              Suggest an edit
            </AuthGateButton>
            <AuthGateButton
              requiredRoles={["EDITOR", "ADMIN"]}
              nextPath={`/p/${id}`}
              href={`/edit/p/new?linkedTo=${id}`}
            >
              Add person
            </AuthGateButton>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="card p-4">
            <h2 className="font-semibold">Tree</h2>
            <p className="mt-2 text-sm text-slate-600">Explore ancestors and descendants in an interactive tree.</p>
            <Link className="mt-3 inline-block text-sm font-semibold text-cyan-700" href={`/tree/${id}`}>
              Open fullscreen tree
            </Link>
          </article>
          <article className="card p-4">
            <h2 className="font-semibold">Family</h2>
            <p className="mt-2 text-sm text-slate-600">Father: {fatherDisplay}</p>
            <p className="mt-1 text-sm text-slate-600">Mother: {motherDisplay}</p>
          </article>
          <article className="card p-4">
            <h2 className="font-semibold">Notes</h2>
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{person.notes_text || "No notes yet."}</p>
          </article>
        </div>
      </section>
    </main>
  );
}
