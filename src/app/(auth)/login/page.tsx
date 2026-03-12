import { LoginForm } from "@/components/ui/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const query = await searchParams;
  const callbackUrl = query.callbackUrl && query.callbackUrl.startsWith("/") ? query.callbackUrl : "/";

  return (
    <main className="container-shell py-10">
      <section className="card mx-auto max-w-md p-6">
        <h1 className="text-2xl font-bold">Login when you need to edit</h1>
        <p className="mt-2 text-sm text-slate-600">
          Browsing is always public. Authentication is only for write actions.
        </p>
        <LoginForm callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
