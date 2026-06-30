export function SignInButton() {
  return (
    <a
      href="/api/auth/login"
      className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-3.5 text-base font-semibold text-[#08090f] shadow-[0_0_40px_-12px_rgba(34,211,238,0.6)] transition hover:bg-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
    >
      <span aria-hidden>⚡</span>
      <span>Sign in with Chutes</span>
    </a>
  );
}
