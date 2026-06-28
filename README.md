# Tunjuk

> Share your screen. Ask anything. AI sees what you see.

**Tunjuk** ("show / point" in Bahasa Malaysia) is an open-source, web-based AI
screen tutor. Inspired by [Farza Majeed's Clicky](https://github.com/farzaa/clicky),
rebuilt for any browser on [Chutes](https://chutes.ai). Each user pays for their
own AI inference through *Sign in with Chutes*, so the project stays free to
host forever.

Built for [Chutes Hack Malaysia 2026](https://luma.com/gdre3p9z), at the
suggestion of the Chutes team.

## Why this exists

The original Clicky is a delightful native macOS app that watches your screen
and answers spoken questions through Anthropic, AssemblyAI, and ElevenLabs.
Every user costs the developer money in inference fees, so Farza had to put
new development behind a paywall.

Tunjuk solves that with **Sign in with Chutes** — a Chutes-only feature where
the user's `chutes:invoke` OAuth scope routes inference billing to the user's
own Chutes account. No developer subsidy. No subscription wall. Scales to
infinite users at zero ongoing inference cost to the project.

## How it works

```
Browser → Next.js (Vercel) → Chutes
   │            │               │
   │            ├─ /api/auth/*  ├─ /idp/authorize, /idp/token, /idp/userinfo
   │            └─ /api/ask     └─ /v1/models, /v1/chat/completions
   │
   ├─ getDisplayMedia()  (screen-share)
   ├─ canvas.toDataURL() (frame extraction)
   └─ Web Speech API     (voice input + text-to-speech)
```

When a TEE-capable vision model is available, Tunjuk pins it automatically and
surfaces a small "Confidential Compute" badge on each answer. The badge proves
the *execution environment* is hardware-isolated (Intel TDX); it does not
prove the AI's fairness or correctness.

## Quick start (local)

```bash
git clone https://github.com/<your-username>/tunjuk
cd tunjuk
npm install

# Register an OAuth app with Chutes (returns client_id and client_secret)
curl -X POST https://api.chutes.ai/idp/apps \
  -H "Authorization: Bearer cpk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tunjuk (local)",
    "redirect_uris": ["http://localhost:3000/api/auth/callback"],
    "allowed_scopes": ["openid", "profile", "chutes:invoke"]
  }'

cp .env.example .env.local
# Fill in CHUTES_CLIENT_ID, CHUTES_CLIENT_SECRET, SESSION_SECRET
# (SESSION_SECRET: run `openssl rand -base64 32`)

npm run dev
```

Open <http://localhost:3000> and click **Sign in with Chutes**.

## Environment variables

| Name | Required | What it does |
|---|---|---|
| `CHUTES_CLIENT_ID` | yes | OAuth app id returned by `POST /idp/apps` |
| `CHUTES_CLIENT_SECRET` | yes | OAuth app secret returned by `POST /idp/apps` |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL, e.g. `https://tunjuk.vercel.app` |
| `SESSION_SECRET` | yes | AES-GCM key for the session cookie. 32-byte random base64. |
| `CHUTES_AUTHORIZE_URL` | no | Defaults to `https://api.chutes.ai/idp/authorize` |
| `CHUTES_TOKEN_URL` | no | Defaults to `https://api.chutes.ai/idp/token` |
| `CHUTES_USERINFO_URL` | no | Defaults to `https://api.chutes.ai/idp/userinfo` |
| `CHUTES_INFERENCE_URL` | no | Defaults to `https://llm.chutes.ai/v1` |
| `CHUTES_VISION_MODEL` | no | Pin a specific model. Empty = auto-pick a vision model, preferring `confidential_compute: true`. |

## Project layout

```
src/
  app/
    api/auth/login    OAuth start (PKCE + state)
    api/auth/callback OAuth callback → exchanges code, sets session cookie
    api/auth/logout   Clears session cookie
    api/auth/me       Returns current user info
    api/ask           Streams a vision answer for {question, imageBase64}
    app/page.tsx      Protected main app (screen share + ask UI)
    page.tsx          Landing page
    layout.tsx        Root layout
  components/
    sign-in-button.tsx
    screen-share.tsx       getDisplayMedia + canvas capture + question form
    voice-input.tsx        Web Speech API STT
    answer-stream.tsx      SSE parsing + render
    attestation-badge.tsx  TEE indicator with honest copy
    tts-player.tsx         Web Speech API TTS
  lib/
    chutes.ts       Model selection + streaming vision client
    env.ts          Typed env access
    pkce.ts         PKCE helpers (RFC 7636)
    session.ts      AES-GCM sealed session cookie + PKCE/state cookies
```

## Deploy

The fastest path is Vercel:

1. Push this repo to GitHub.
2. Import into Vercel.
3. Set the env vars from the table above (use your Vercel URL for `NEXT_PUBLIC_APP_URL`).
4. Update the redirect URI on your Chutes OAuth app to `https://<your-vercel-url>/api/auth/callback`.

## License

MIT. See [LICENSE](./LICENSE).

## Credits

- [Farza Majeed](https://github.com/farzaa) for the original Clicky.
- The [Chutes](https://chutes.ai) team — the Clicky-on-Chutes idea came directly from them.
- [Nyala Labs](https://luma.com/user/nyala) for organizing Chutes Hack Malaysia 2026.

## Honest scope notes

- **Voice input** uses the browser's Web Speech API. Works on Chrome and Edge reliably; Safari has prefix support; Firefox falls back to text input.
- **TTS** uses the browser's `speechSynthesis`. Voices vary by OS.
- **Attestation** badge appears when the chosen Chutes model exposes `confidential_compute: true`. The badge proves the *execution environment* is hardware-isolated; it does **not** prove the AI's fairness, accuracy, or determinism.
- **No data persistence**. Sessions live in an encrypted HTTP-only cookie. Screen captures live only in browser memory and are sent once per question.
