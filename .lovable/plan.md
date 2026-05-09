## What I pulled from `amazinglg/vibetribe`

Cloned the repo (`main` branch). It contains:

- **32 source files** (~5,100 lines): Next.js App Router pages, components, contexts, store, encryption lib, middleware
- **2 Supabase migrations** (`vibetribe_full_schema`, `add_e2e_and_visibility`)
- **5 public assets**: favicon, manifest, sw.js, app_logo.png, no_image.png
- **Stack**: Next.js 15 + React 19, Supabase SSR auth, Tailwind 3, framer-motion, recharts, sonner, zustand, @heroicons/react, @supabase/ssr, custom Web Crypto E2E encryption, PWA service worker

## Why this needs porting (not just copying)

This Lovable template is **TanStack Start v1**, not Next.js. The following Next-only APIs do not exist here and must be mirrored:

| Next.js API used | Replacement in this template |
|---|---|
| `src/app/*/page.tsx` (App Router) | `src/routes/*.tsx` (file-based, dot-separated) |
| `next/link`, `next/navigation` (`useRouter`, `redirect`) | `@tanstack/react-router` (`Link`, `useNavigate`, `useRouter`) |
| `next/image` | plain `<img>` wrapper (keeps the `AppImage` API and fallback logic identical) |
| `next/font/google` (Plus Jakarta Sans) | Google Fonts `<link>` in `__root.tsx` head |
| `export const metadata` per page | `head()` per route file |
| `src/middleware.ts` (server auth gate) | `_authenticated` layout route + client redirect (same protected paths) |
| `@supabase/ssr` `createServerClient` / `createBrowserClient` | Lovable Cloud's bundled `@supabase/supabase-js` browser client |
| Tailwind v3 `tailwind.config.js` + custom CSS vars | Tailwind v4 `@theme` block in `src/styles.css`, mirroring all your custom tokens |
| `next.config.mjs` image hosts, `public/sw.js` | `public/sw.js` kept as-is, registered the same way |

Everything else (auth flows, chat panels, status screen, profile, admin, vault, encryption, PWA banner, zustand store, sonner toasts, framer-motion, recharts, heroicons) is supported and will be copied with the smallest possible diff.

## Plan

1. **Backend**: Enable Lovable Cloud, then apply both Supabase migrations verbatim as new timestamped migrations.
2. **Dependencies**: `bun add` framer-motion, sonner, zustand, recharts, @heroicons/react, @supabase/supabase-js. Remove the placeholder `src/routes/index.tsx`.
3. **Design system**: Port your Tailwind tokens (gradients, glow shadows, custom colors like `onBackground`, `gradient-bg-page`, `gradient-primary`) into `src/styles.css` `@theme` so existing classnames keep working without touching component JSX.
4. **Shared lib**:
   - `src/lib/supabase/client.ts` → returns `@supabase/supabase-js` browser client using `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (Cloud-injected). Same `createClient()` export, no caller changes.
   - `src/lib/encryption.ts` → copied 1:1 (Web Crypto + IndexedDB, framework-agnostic).
   - `src/contexts/AuthContext.tsx` → copied 1:1 (already client-only).
   - `src/store/chatStore.ts` → copied 1:1.
5. **Routes** (`src/routes/`):
   - `__root.tsx` — wraps `AuthProvider`, mounts `<Toaster>`, registers SW, loads Plus Jakarta Sans, sets viewport/manifest/icons; preserves your `<script>` tags? → **dropped** (rocket.new tagger is a Next-only build helper, not needed here).
   - `index.tsx` — chats home (`ChatListPanel` + `ChatWindowPanel`).
   - `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `complete-profile.tsx`, `status-screen.tsx`, `profile-screen.tsx`, `admin.tsx` — one route per Next page, body copied with only `next/*` imports swapped.
   - Auth gating handled inline in each protected route via `useAuth()` + `useNavigate({ to: '/sign-in' })`, mirroring your middleware's protected/auth-page lists exactly.
6. **Components**: `AppLayout`, `ChatListPanel`, `ChatWindowPanel`, `ContactsPanel`, `MarkSecureModal`, `SecureVaultModal`, `PWAInstallBanner`, `ServiceWorkerRegistration`, `ui/AppIcon`, `ui/AppImage` (rewritten as plain `<img>` keeping props/fallback API), `ui/AppLogo`, plus `profile-screen/components/*` and `status-screen/components/*` — all copied with `'use client'` removed and `next/*` imports swapped.
7. **Public assets**: copy `app_logo.png`, `no_image.png`, `favicon.ico`, `manifest.json`, `sw.js` to `public/`.

## Things I will be altering (full list)

- **Removed entirely**:
  - `next`, `next/font`, `@netlify/plugin-nextjs`, `eslint-config-next`, `@dhiwise/component-tagger`, `next.config.mjs`, `tailwind.config.js`, `postcss.config.js`, `src/middleware.ts`, `next-env.d.ts`, `image-hosts.config.mjs`
  - The two `<script>` tags pointing to `static.rocket.new` (Next-host-specific telemetry)
  - `@supabase/ssr` (replaced by browser-only client; no SSR auth cookies in this template)
  - Server-side metadata exports (replaced by route `head()`)
- **Rewritten (same API, different impl)**:
  - `AppImage` — drops `next/image` optimization for `<img>` with the same fallback/loading/onClick props
  - `client.tsx` → `client.ts` using `@supabase/supabase-js`
  - Page files moved from `src/app/.../page.tsx` to `src/routes/*.tsx`
- **Auth gate**: middleware logic re-implemented client-side per protected route (same path lists). Same UX, but redirect happens on mount instead of edge.

## Things pending / open questions

1. **Env vars**: Lovable Cloud auto-provides `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Your repo references `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`. I'll wire the Cloud vars — **the existing data in your Supabase project will not move with the code**; this will spin up a fresh Lovable Cloud Supabase project. If you want the existing data, share your current Supabase URL/keys and I'll point to that instead.
2. **`x-sb-token` header injection** in your middleware (used for cross-domain token handoff) has no equivalent here — dropping it. Confirm if any external system depends on this.
3. **PWA service worker** (`public/sw.js`) will be served, but TanStack Start uses Vite — if `sw.js` references Next's `_next/` cache paths, it may need a small URL rewrite. I'll review on copy.
4. **`recharts`** isn't actually imported anywhere I've scanned yet — I'll add it only if `admin/page.tsx` or another file uses it.

## Things that won't get pulled

- `next.config.mjs`, `tailwind.config.js`, `postcss.config.js`, `next-env.d.ts`, `src/middleware.ts`, `image-hosts.config.mjs`, the rocket.new script tags. All are Next/Netlify-specific build glue with no behavior to preserve.

Approve this and I'll execute the full port in one pass, then list any file that didn't translate cleanly.