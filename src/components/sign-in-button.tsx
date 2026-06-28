export function SignInButton() {
  return (
    <a
      href="/api/auth/login"
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
    >
      <span aria-hidden>🔑</span>
      <span>Sign in with Chutes</span>
    </a>
  );
}
