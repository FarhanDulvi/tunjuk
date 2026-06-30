import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { ScreenShare } from "@/components/screen-share";
import { TunjukMark } from "@/components/tunjuk-mark";

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
      <header className="mb-10 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-200 transition hover:text-white"
        >
          <TunjukMark size={26} className="text-zinc-300" pulse />
          <span>Tunjuk</span>
          <span className="ml-3 text-xs font-normal text-zinc-500">
            signed in as{" "}
            <span className="font-medium text-zinc-300">{displayName}</span>
          </span>
        </Link>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            Sign out
          </button>
        </form>
      </header>
      <ScreenShare />
    </main>
  );
}
