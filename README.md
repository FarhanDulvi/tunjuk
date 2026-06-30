# Tunjuk

> Share your screen. Ask anything. Tunjuk reads what you see and tells you where to click.

**Tunjuk** ("show / point" in Bahasa Malaysia) is an open-source, web-based AI
screen tutor. Pick any window, ask any question — Tunjuk reads the frame and
answers out loud, with cyan bounding boxes highlighting the exact regions the
answer is pointing at. Built on [Chutes](https://chutes.ai) so every user pays
for their own inference; the project itself holds zero credits and stays free
to host forever.

Built for [Chutes Hack Malaysia 2026](https://luma.com/gdre3p9z).

**Live**: <https://tunjuk.vercel.app>

## Why this exists

Today's AI screen tutors lock you into a desktop app, a vendor subscription,
or both — and the vendor pays the AI bill, so the free tier shrinks every
quarter. Tunjuk takes the opposite stance:

- **Browser-native.** No install, no extension, no native binary. If your
  browser can screen-share, Tunjuk works.
- **You pay for what you use.** Sign in with Chutes once. The `chutes:invoke`
  OAuth scope routes every inference call to your own Chutes account. No
  developer subsidy, no subscription wall, no per-seat pricing.
- **Verifiable execution.** When a TEE-attested vision model is available,
  Tunjuk pins it and surfaces a hardware-attested "Confidential Compute"
  badge — your shared screen is processed inside an Intel TDX enclave the
  cloud operator cannot read into.
- **Annotation overlay.** A second non-streaming pass asks the model for
  bounding-box coordinates of the UI elements the answer references. Tunjuk
  renders these as cyan dashed boxes with numbered labels on the captured
  frame so you can see exactly where to look.
- **Floating panel.** Document Picture-in-Picture window that follows you
  across tabs, so you can act on the answer without losing your place. The
  panel is automatically hidden during frame capture so it never appears in
  the screenshot, even when you're sharing your whole screen.
- **Sponsored demo tier.** Every new signed-in user gets **20 free prompts**
  on a project-owned Chutes key. After that they top up at chutes.ai and
  keep using the same account. The economics scale to infinite users at
  literally zero ongoing cost.
- **Nothing persisted.** No database, no logs, no analytics. Sessions live in
  an AES-GCM sealed HTTP-only cookie; screen captures live in browser memory
  and are sent exactly once per question. The only state we store is a
  per-user prompt counter in Upstash Redis (an integer, no PII).

## How it works

```
Browser → Next.js 16 on Vercel → Chutes
   │              │                 │
   │              ├─ /api/auth/*    ├─ /idp/authorize, /idp/token
   │              ├─ /api/ask       ├─ /v1/models, /v1/chat/completions
   │              ├─ /api/annotate  └─ Intel TDX confidential compute
   │              ├─ /api/summarise
   │              └─ /api/quota → Upstash Redis (demo counter)
   │
   ├─ getDisplayMedia()           screen-share (tab / window / screen)
   ├─ canvas.toDataURL()          single-frame extract per question
   ├─ Document Picture-in-Picture floating ask panel
   └─ Web Speech API              voice input + text-to-speech
```

The vision picker reads `/v1/models`, prefers entries with `input_modalities`
containing `"image"`, and biases toward `confidential_compute: true` (or a
`-TEE` id suffix). The chosen model id is returned to the browser on every
answer (`X-Tunjuk-Model` header) so you can verify what ran. The TEE flag is
returned in `X-Tunjuk-Tee` and the demo-fallback flag in `X-Tunjuk-Demo`.

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
# Demo tier env vars are optional — leave blank to disable that fallback.

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
| `CHUTES_VISION_MODEL` | no | Pin a specific model. Empty = auto-pick. |
| `CHUTES_DEMO_KEY` | no | A `cpk_...` Chutes API key that funds the per-user demo allowance. |
| `UPSTASH_REDIS_REST_URL` | no | Upstash REST URL for the demo-counter store. |
| `UPSTASH_REDIS_REST_TOKEN` | no | Upstash REST token. |

The demo tier activates only when all three of the bottom vars are set. The
env resolver accepts the Vercel-Upstash Marketplace integration's variant
names too (`UPSTASH_REDIS_KV_REST_API_URL`, `KV_REST_API_URL`, etc.) — see
`src/lib/env.ts`.

## Diagnostics

```
GET /api/health                  → { ok, version, time }
GET /api/health?check=models     → counts of vision + TEE models on Chutes (auth)
GET /api/health?check=demo       → which demo-tier env vars are wired (no values)
GET /api/quota                   → { enabled, used, limit } for the signed-in user
GET /api/debug/models            → full model catalog the picker would pick from
```

## Project layout

```
src/
  app/
    api/auth/login     OAuth start (PKCE + state)
    api/auth/callback  OAuth callback → exchanges code, sets session cookie
    api/auth/logout    Clears session cookie
    api/auth/me        Returns current user info
    api/ask            Streams a vision answer; retries with demo key on 402
    api/annotate       Returns JSON bounding boxes for the answered regions
    api/summarise      End-of-session digest; same demo-tier fallback as /api/ask
    api/quota          Per-user demo-tier counter for the UI chip
    api/health         Liveness + diagnostics (no auth for basic check)
    api/debug/models   Lists vision-capable models the picker can choose
    app/page.tsx       Protected main app (screen share + ask UI)
    page.tsx           Landing page
    layout.tsx         Root layout
  components/
    sign-in-button.tsx
    screen-share.tsx          getDisplayMedia + canvas capture + question form
    voice-input.tsx           Web Speech API STT
    answer-stream.tsx         SSE parsing + render + watchdog + annotate trigger
    annotated-screenshot.tsx  SVG overlay with cyan boxes on the captured frame
    attestation-badge.tsx     TEE indicator with honest copy
    persistence-badge.tsx     "Nothing persisted" indicator
    tts-player.tsx            Web Speech API TTS (opt-in, no auto-read)
    pip-portal.tsx            Document Picture-in-Picture portal
    tunjuk-mark.tsx           Viewfinder reticle brand mark
    hero-intro.tsx            Landing hero
    how-it-works.tsx          Interactive 4-step SVG carousel
    reveal.tsx                Section wrapper
    tubes-background.tsx      3D neon tubes background (CDN-loaded threejs)
  lib/
    chutes.ts        Model selection + streaming vision client + annotations
    chutes-text.ts   Lightweight text model client for summaries
    env.ts           Typed env access, tolerant of Marketplace name variants
    pkce.ts          PKCE helpers (RFC 7636)
    session.ts       AES-GCM sealed session cookie + PKCE/state cookies
    quota.ts         Upstash Redis per-user demo counter
```

## Deploy

The fastest path is Vercel:

1. Push this repo to GitHub.
2. Import into Vercel.
3. Set the four required env vars from the table above. Use your Vercel URL
   for `NEXT_PUBLIC_APP_URL`.
4. Update the redirect URI on your Chutes OAuth app to
   `https://<your-vercel-url>/api/auth/callback`.
5. **(Optional, for the demo tier)** Vercel → Storage → connect **Upstash for
   Redis** (free tier is plenty) and let the integration auto-inject the env
   vars. Then add `CHUTES_DEMO_KEY` manually with a fresh `cpk_...` key whose
   wallet you've topped up to sponsor new users. Redeploy. Visit
   `/api/health?check=demo` to confirm `enabled: true`.

## Credits

- Built solo by [Farhan Dulvi](https://github.com/FarhanDulvi).
- UI design contributions by [Aariz Sajan](https://github.com/Aariz27).
- Built on [Chutes](https://chutes.ai) — sponsored by Nyala Labs for Chutes
  Hack Malaysia 2026.

## License

MIT. See [LICENSE](./LICENSE).

## Honest scope notes

- **Voice input** uses the browser's Web Speech API. Works reliably on Chrome
  and Edge; Safari has prefix support; Firefox falls back to typed input.
- **TTS** uses the browser's `speechSynthesis`. Voices vary by OS. Tunjuk
  never auto-reads — you click **Speak** to listen.
- **Floating panel** uses the Document Picture-in-Picture API (Chromium-only
  today). The captured frame excludes the floating panel even when you share
  the whole screen — the panel is briefly hidden during capture.
- **Attestation badge** appears when the chosen Chutes model exposes
  `confidential_compute: true` or a `-TEE` id suffix. The badge proves the
  *execution environment* is hardware-isolated; it does **not** prove the
  AI's fairness, accuracy, or determinism.
- **Annotations** are best-effort. Vision model coordinate accuracy varies;
  Tunjuk validates every box stays inside the frame and silently drops the
  overlay if the model returns nothing high-confidence. The prose answer is
  never broken by a failed annotation pass.
- **Demo tier** is sponsored by a project-owned Chutes key, capped per user
  in Upstash Redis. The counter resets only if you reset Redis — clearing
  cookies or signing out does not grant new free prompts.
- **No data persistence.** Sessions live in an encrypted HTTP-only cookie.
  Screen captures live only in browser memory and are sent once per question.
  Upstash holds nothing but `tunjuk:demo:{user-id-slug} → integer`.

## What's next

- **Chrome extension** to draw arrows on the user's live screen, not on a
  snapshot. The one thing a pure-web app fundamentally cannot do.
- **Tighter vision coordinates** via specialized prompting and a small
  fine-tune for pixel-accurate bounding boxes.
- **Mobile companion** with iOS / Android share-sheet integration.
