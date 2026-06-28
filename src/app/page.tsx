import Link from "next/link";
import { readSession } from "@/lib/session";
import { SignInButton } from "@/components/sign-in-button";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

const ERROR_COPY: Record<string, string> = {
  missing_code: "OAuth response was missing the authorization code.",
  bad_state: "OAuth state mismatch — sign in again.",
  token_parse_failed: "Could not parse the token response from Chutes.",
  token_exchange_failed: "Chutes rejected the token exchange.",
  chutes_request_failed: "Could not reach Chutes inference.",
  unauthorized: "Your session expired — please sign in again.",
};

export default async function Home({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const session = await readSession();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <header className="mb-10 space-y-3">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900">
          Tunjuk
        </h1>
        <p className="text-sm italic text-slate-500">
          <span className="not-italic font-semibold">Tunjuk</span> —
          &ldquo;tunjukkan saya&rdquo; in Bahasa Malaysia (show me).
        </p>
        <p className="text-xl text-slate-700">
          Share your screen. Ask anything. AI sees what you see.
        </p>
        <p className="text-base text-slate-600">
          Inspired by Farza Majeed&apos;s{" "}
          <a
            href="https://github.com/farzaa/clicky"
            className="font-medium text-emerald-700 underline underline-offset-2"
            rel="noopener noreferrer"
          >
            Clicky
          </a>
          . Rebuilt for the web on{" "}
          <a
            href="https://chutes.ai"
            className="font-medium text-emerald-700 underline underline-offset-2"
            rel="noopener noreferrer"
          >
            Chutes
          </a>
          . Each user pays their own AI bill via{" "}
          <em>Sign in with Chutes</em>, so this stays free to host forever and
          open-source from day one.
        </p>
      </header>

      <blockquote className="mb-8 border-l-4 border-emerald-400 pl-4 italic text-slate-700">
        &ldquo;Chutes is an open source inference provider — bring any brain to
        that body.&rdquo;
        <footer className="mt-1 text-xs not-italic text-slate-500">
          — Vince, Chutes
        </footer>
      </blockquote>

      {error && ERROR_COPY[error] ? (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {ERROR_COPY[error]}
        </p>
      ) : null}

      <div className="mb-12 flex flex-wrap items-center gap-4">
        {session ? (
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            Open Tunjuk →
          </Link>
        ) : (
          <SignInButton />
        )}
        <a
          href="https://github.com/farzaa/clicky"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-100"
          rel="noopener noreferrer"
        >
          The original Clicky →
        </a>
      </div>

      <section className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sign in with Chutes
          </h2>
          <p className="text-sm text-slate-700">
            Your bill, not ours. OAuth into Chutes; this app never holds
            inference credit.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Confidential Compute (TEE)
          </h2>
          <p className="text-sm text-slate-700">
            When a TEE-attested model is available, Tunjuk picks it
            automatically and shows a verifiable badge in the answer header.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Open-source MIT
          </h2>
          <p className="text-sm text-slate-700">
            Self-host the whole thing. No vendor lock-in, no hidden middleware
            — see the GitHub repo.
          </p>
        </div>
      </section>

      <footer className="mt-16 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          Open source under the MIT license. Inspired by{" "}
          <a
            href="https://github.com/farzaa/clicky"
            className="underline"
            rel="noopener noreferrer"
          >
            farzaa/clicky
          </a>
          . Built for{" "}
          <a
            href="https://luma.com/gdre3p9z"
            className="underline"
            rel="noopener noreferrer"
          >
            Chutes Hack Malaysia 2026
          </a>{" "}
          on the suggestion of the Chutes team.
        </p>
      </footer>
    </main>
  );
}
