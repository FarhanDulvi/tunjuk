import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { ScreenShare } from "@/components/screen-share";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const session = await readSession();
  if (!session) {
    redirect("/");
  }
  const displayName =
    session.user?.name ??
    session.user?.username ??
    session.user?.email ??
    "Signed in";

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tunjuk</h1>
          <p className="text-sm text-slate-600">
            Signed in as <span className="font-medium">{displayName}</span>
          </p>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </header>
      <ScreenShare />
    </main>
  );
}
