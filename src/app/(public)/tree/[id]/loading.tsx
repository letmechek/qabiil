import { LoadingStatusNote } from "@/components/ui/loading-status-note";

export default function TreeLoading() {
  return (
    <main className="container-shell py-4">
      <section className="card p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="mb-3 h-8 w-56 rounded bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-200" />

          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="h-7 w-40 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-72 rounded bg-slate-200" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-80 rounded bg-slate-200" />
              <div className="h-4 w-72 rounded bg-slate-200" />
              <div className="h-4 w-64 rounded bg-slate-200" />
              <div className="h-4 w-56 rounded bg-slate-200" />
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="h-7 w-44 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-80 rounded bg-slate-200" />
            <div className="mt-4 space-y-4">
              <div className="h-4 w-60 rounded bg-slate-200" />
              <div className="ml-6 h-4 w-56 rounded bg-slate-200" />
              <div className="ml-12 h-4 w-52 rounded bg-slate-200" />
              <div className="ml-18 h-4 w-48 rounded bg-slate-200" />
            </div>
          </section>
        </div>
      </section>
      <LoadingStatusNote kind="tree" />
    </main>
  );
}
