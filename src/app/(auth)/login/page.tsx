import { Suspense } from "react";

import { LoginForm } from "@/components/ui/login-form";

export default function LoginPage() {
  return (
    <main className="container-shell py-10">
      <section className="card mx-auto max-w-md p-6">
        <h1 className="text-2xl font-bold">Login when you need to edit</h1>
        <p className="mt-2 text-sm text-slate-600">
          Browsing is always public. Authentication is only for write actions.
        </p>

        <Suspense fallback={<p className="mt-4 text-sm text-slate-600">Loading form...</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
