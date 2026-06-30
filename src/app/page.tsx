import Link from "next/link";
import { readSession } from "@/lib/session";
import { TunjukMark } from "@/components/tunjuk-mark";
import { HeroIntro } from "@/components/hero-intro";
import { HowItWorks } from "@/components/how-it-works";
import { TubesBackground } from "@/components/tubes-background";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; error_detail?: string }>;
}

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
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-semibold text-[#0a0a0a] transition hover:bg-brand-400"
            >
              Open app →
            </Link>
          ) : null}
        </div>
      </nav>

      <HeroIntro
        hasSession={!!session}
        error={error}
        errorDetail={error_detail}
      />

      <Reveal className="mb-28">
        <TubesBackground className="h-[380px] sm:h-[460px]" />
      </Reveal>

      <Reveal className="mb-28 grid gap-4 sm:grid-cols-3">
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
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0d0f12] p-6 transition hover:border-white/20 hover:bg-[#13161b]"
          >
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <h3 className="mb-2 text-base font-semibold text-white">
              {card.title}
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">{card.body}</p>
          </div>
        ))}
      </Reveal>

      <Reveal className="mb-28">
        <HowItWorks />
      </Reveal>

      <Reveal className="mb-20 grid gap-8 rounded-2xl border border-white/10 bg-[#0d0f12] p-8 sm:grid-cols-2 sm:p-12">
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
              <span className="mt-1 text-brand-400">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </Reveal>

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
