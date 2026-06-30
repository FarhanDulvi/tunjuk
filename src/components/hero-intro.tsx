"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { SignInButton } from "@/components/sign-in-button";

const ERROR_COPY: Record<string, string> = {
  missing_code: "OAuth response was missing the authorization code.",
  bad_state: "OAuth state mismatch — sign in again.",
  token_parse_failed: "Could not parse the token response from Chutes.",
  token_exchange_failed: "Chutes rejected the token exchange.",
  chutes_request_failed: "Could not reach Chutes inference.",
  unauthorized: "Your session expired — please sign in again.",
};

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

export function HeroIntro({
  hasSession,
  error,
  errorDetail,
}: {
  hasSession: boolean;
  error?: string;
  errorDetail?: string;
}) {
  const reduced = useReducedMotion();
  const mp = reduced
    ? {}
    : { variants: container, initial: "hidden" as const, animate: "show" as const };
  const iv = reduced ? {} : { variants: item };

  return (
    <motion.section className="mb-28 flex flex-col items-start" {...mp}>
      <motion.span
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-400/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand-300"
        {...iv}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
        Powered by Chutes confidential compute
      </motion.span>

      <motion.h1
        className="mb-6 max-w-4xl text-6xl font-bold leading-[1.05] tracking-tight text-white sm:text-7xl"
        {...iv}
      >
        <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-brand-500 bg-clip-text text-transparent">
          AI
        </span>{" "}
        that watches{" "}
        <span className="bg-gradient-to-r from-brand-300 to-brand-300 bg-clip-text text-transparent">
          your screen
        </span>{" "}
        and tells you what to do.
      </motion.h1>

      <motion.p
        className="mb-10 max-w-2xl text-xl leading-relaxed text-zinc-400"
        {...iv}
      >
        Share any window. Ask anything. Tunjuk reads what you see and answers out
        loud — privately, on hardware-isolated GPUs, billed to your own Chutes
        wallet.
      </motion.p>

      {error && ERROR_COPY[error] ? (
        <motion.div
          className="mb-8 w-full max-w-2xl rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"
          {...iv}
        >
          <div className="font-semibold">{ERROR_COPY[error]}</div>
          {errorDetail ? (
            <div className="mt-1 font-mono text-xs text-amber-300/70">
              {errorDetail}
            </div>
          ) : null}
        </motion.div>
      ) : null}

      <motion.div className="flex flex-wrap items-center gap-4" {...iv}>
        {hasSession ? (
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3.5 text-base font-semibold text-[#0a0a0a] shadow-[0_0_40px_-12px_rgba(34,211,238,0.6)] transition hover:bg-brand-400"
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
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#13161b] px-6 py-3.5 text-base font-medium text-zinc-200 transition hover:border-white/20 hover:bg-[#1a1e24]"
        >
          View source
        </a>
      </motion.div>
    </motion.section>
  );
}
