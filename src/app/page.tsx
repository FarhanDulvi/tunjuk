import Link from "next/link";
import { readSession } from "@/lib/session";
import { SignInButton } from "@/components/sign-in-button";
import { TunjukMark } from "@/components/tunjuk-mark";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; error_detail?: string }>;
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
  const { error, error_detail } = await searchParams;
  const session = await readSession();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
      <nav className="mb-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-zinc-200">
          <TunjukMark size={26} className="text-zinc-300" pulse />
          <span>Tunjuk</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <a
            href="https://github.com/FarhanDulvi/tunjuk"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-zinc-100"
          >
            GitHub
          </a>
          <a
            href="https://chutes.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-zinc-100"
          >
            Chutes
          </a>
          {session ? (
            <Link
              href="/app"
              className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-[#08090f] transition hover:bg-cyan-400"
            >
              Open app →
            </Link>
          ) : null}
        </div>
      </nav>

      <section className="mb-28 flex flex-col items-start">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-cyan-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          Powered by Chutes confidential compute
        </span>
        <h1 className="mb-6 max-w-4xl text-6xl font-bold leading-[1.05] tracking-tight text-white sm:text-7xl">
          AI that watches{" "}
          <span className="bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
            your screen
          </span>{" "}
          and tells you what to do.
        </h1>
        <p className="mb-10 max-w-2xl text-xl leading-relaxed text-zinc-400">
          Share any window. Ask anything. Tunjuk reads what you see and answers
          out loud — privately, on hardware-isolated GPUs, billed to your own
          Chutes wallet.
        </p>

        {error && ERROR_COPY[error] ? (
          <div className="mb-8 w-full max-w-2xl rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
            <div className="font-semibold">{ERROR_COPY[error]}</div>
            {error_detail ? (
              <div className="mt-1 font-mono text-xs text-amber-300/70">
                {error_detail}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          {session ? (
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-3.5 text-base font-semibold text-[#08090f] shadow-[0_0_40px_-12px_rgba(34,211,238,0.6)] transition hover:bg-cyan-400"
            >
              Open Tunjuk →
            </Link>
          ) : (
            <SignInButton />
          )}
          <a
            href="https://github.com/FarhanDulvi/tunjuk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-6 py-3.5 text-base font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08]"
          >
            View source
          </a>
        </div>
      </section>

      <section className="mb-28 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Bring your own compute",
            body: "OAuth into Chutes once. Every inference call is billed to your wallet, not to anyone else. Tunjuk holds zero credits and never pays for your usage.",
          },
          {
            title: "Confidential by hardware",
            body: "When a TEE-attested model is available, we pin it. Your shared screen is processed inside an Intel TDX enclave that operators cannot read into.",
          },
          {
            title: "Nothing to install",
            body: "Web-native. Browser screen-share, voice-in, voice-out — no extensions, no native app, no permissions you do not grant in the browser itself.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <h3 className="mb-2 text-base font-semibold text-white">
              {card.title}
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">{card.body}</p>
          </div>
        ))}
      </section>

      <section className="mb-28">
        <h2 className="mb-10 text-3xl font-bold tracking-tight text-white">
          How it works
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] sm:grid-cols-4">
          {[
            {
              n: "01",
              title: "Sign in with Chutes",
              body: "PKCE OAuth scoped to chutes:invoke.",
            },
            {
              n: "02",
              title: "Share a screen",
              body: "A browser tab, a window, or a screenshot upload.",
            },
            {
              n: "03",
              title: "Ask out loud",
              body: "Web Speech transcribes your question on-device.",
            },
            {
              n: "04",
              title: "Get an answer",
              body: "Streams from a confidential-compute vision model on your Chutes account.",
            },
          ].map((step) => (
            <li
              key={step.n}
              className="flex flex-col gap-3 bg-[#0a0d18] p-6"
            >
              <span className="font-mono text-xs text-cyan-400">{step.n}</span>
              <h3 className="text-sm font-semibold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-20 grid gap-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 sm:grid-cols-2 sm:p-12">
        <div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white">
            Built on what you can verify.
          </h2>
          <p className="text-zinc-400">
            Every answer comes with the model id Tunjuk picked, time-to-first-byte,
            total stream duration, and a verifiable Confidential Compute badge
            when the inference ran inside an Intel TDX enclave.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-zinc-300">
          {[
            "Picked-model label on every answer.",
            "TTFB + total stream timer.",
            "Confidential Compute attestation badge (proves environment, not correctness).",
            "No data persisted: stateless functions, no DB, no logs.",
            "MIT-licensed. Fork it and deploy your own in one click.",
          ].map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-1 text-cyan-400">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto border-t border-white/10 pt-8 text-xs text-zinc-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>
            Tunjuk — built for{" "}
            <a
              href="https://luma.com/gdre3p9z"
              className="underline-offset-2 hover:text-zinc-300 hover:underline"
              rel="noopener noreferrer"
            >
              Chutes Hack Malaysia 2026
            </a>
            . MIT.
          </span>
          <span>
            <a
              href="https://github.com/FarhanDulvi/tunjuk"
              className="underline-offset-2 hover:text-zinc-300 hover:underline"
              rel="noopener noreferrer"
            >
              github.com/FarhanDulvi/tunjuk
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
