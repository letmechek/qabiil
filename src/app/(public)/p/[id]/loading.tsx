import { LoadingStatusNote } from "@/components/ui/loading-status-note";

export default function PersonLoading() {
  return (
    <main className="container-shell py-6">
      <section className="card p-6">
        <div className="animate-pulse">
          <div className="h-10 w-64 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-28 rounded bg-slate-200" />

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="card p-4">
              <div className="h-6 w-20 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full rounded bg-slate-200" />
              <div className="mt-2 h-4 w-32 rounded bg-slate-200" />
            </div>
            <div className="card p-4">
              <div className="h-6 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-40 rounded bg-slate-200" />
              <div className="mt-2 h-4 w-36 rounded bg-slate-200" />
            </div>
            <div className="card p-4">
              <div className="h-6 w-20 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full rounded bg-slate-200" />
              <div className="mt-2 h-4 w-3/4 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </section>
      <LoadingStatusNote />
    </main>
  );
}
