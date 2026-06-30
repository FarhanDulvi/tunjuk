# Tunjuk

> Share your screen. Ask anything. AI sees what you see.

**Tunjuk** ("show / point" in Bahasa Malaysia) is an open-source, web-based AI
screen tutor. Pick any window, ask any question — Tunjuk reads the frame and
answers out loud. Built on [Chutes](https://chutes.ai) so every user pays for
their own inference; the project itself holds no credits and stays free to
host forever.

Built for [Chutes Hack Malaysia 2026](https://luma.com/gdre3p9z).

## Why this exists

Most AI assistants either lock you into a desktop app, mediate every request
through a vendor's wallet, or hide what model actually answered you. Tunjuk
takes the opposite stance:

- **Browser-native.** No install, no extension, no native binary. If your
  browser can screen-share, Tunjuk works.
- **You pay for what you use.** Sign in with Chutes once. The `chutes:invoke`
  OAuth scope routes every inference call to your own Chutes account. No
  developer subsidy, no subscription wall, no per-seat pricing.
- **Verifiable execution.** When a TEE-attested vision model is available,
  Tunjuk pins it and surfaces a hardware-attested "Confidential Compute"
  badge — your shared screen is processed inside an Intel TDX enclave that
  the operator cannot read into.
- **Nothing persisted.** No database, no logs, no analytics. Sessions live in
  an AES-GCM sealed HTTP-only cookie; screen captures live in browser memory
  and are sent exactly once per question.

## How it works

```
Browser → Next.js (Vercel) → Chutes
   │            │               │
   │            ├─ /api/auth/*  ├─ /idp/authorize, /idp/token, /idp/userinfo
   │            └─ /api/ask     └─ /v1/models, /v1/chat/completions
   │
   ├─ getDisplayMedia()           (screen-share — tab/window/screen)
   ├─ canvas.toDataURL()          (frame extraction)
   ├─ Document Picture-in-Picture (floating ask panel)
   └─ Web Speech API              (voice input + text-to-speech)
```

The vision picker reads `/v1/models`, prefers entries with `input_modalities`
containing `"image"`, and biases toward `confidential_compute: true` (or a
`-TEE` id suffix). The chosen model id is returned to the browser on every
answer so you can verify what ran.

## Quick start (local)

```bash
git clone https://github.com/FarhanDulvi/tunjuk
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
    api/summarise     Generates an end-of-session digest
    api/debug/models  Lists vision-capable models the picker can pick
    app/page.tsx      Protected main app (screen share + ask UI)
    page.tsx          Landing page
    layout.tsx        Root layout
  components/
    sign-in-button.tsx
    screen-share.tsx       getDisplayMedia + canvas capture + question form
    voice-input.tsx        Web Speech API STT
    answer-stream.tsx      SSE parsing + render
    attestation-badge.tsx  TEE indicator with honest copy
    persistence-badge.tsx  "Nothing persisted" indicator
    tts-player.tsx         Web Speech API TTS
    pip-portal.tsx         Document Picture-in-Picture portal
    tunjuk-mark.tsx        Viewfinder reticle brand mark
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

## Honest scope notes

- **Voice input** uses the browser's Web Speech API. Works reliably on Chrome
  and Edge; Safari has prefix support; Firefox falls back to typed input.
- **TTS** uses the browser's `speechSynthesis`. Voices vary by OS. Tunjuk
  never auto-reads — you click **Speak** to listen.
- **Floating panel** uses the Document Picture-in-Picture API (Chromium-only
  today). The captured frame excludes the floating panel even when sharing
  the whole screen.
- **Attestation** badge appears when the chosen Chutes model exposes
  `confidential_compute: true` or a `-TEE` id suffix. The badge proves the
  *execution environment* is hardware-isolated; it does **not** prove the
  AI's fairness, accuracy, or determinism.
- **No data persistence.** Sessions live in an encrypted HTTP-only cookie.
  Screen captures live only in browser memory and are sent once per question.
