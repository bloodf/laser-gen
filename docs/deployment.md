# Deployment

laser-gen is a fully client-side PWA (no server, no database), so any static host works.
The production output is generated with `pnpm generate` into `.output/public`.

## Vercel (recommended)

The repo ships a ready-to-use `vercel.json`:

- **Build command:** `pnpm generate`
- **Output directory:** `.output/public`
- **SPA fallback:** unknown routes rewrite to `/index.html` (client-side router takes over)
- **Caching:** `sw.js` and the web manifest are served `no-cache`; hashed `_nuxt/` assets are immutable

### One-time setup

```bash
pnpm dlx vercel login
pnpm dlx vercel link        # create/link the Vercel project (accept defaults)
```

### Deploy

```bash
pnpm dlx vercel --prod      # production deploy
```

Or connect the GitHub repo in the Vercel dashboard — the `vercel.json` is picked up
automatically and every push to `main` deploys.

## Other static hosts

- **Cloudflare Pages:** build `pnpm generate`, output `.output/public`; add an SPA
  fallback (`/* → /index.html`, 200).
- **GitHub Pages:** build `pnpm generate` and publish `.output/public`. Set
  `NUXT_APP_BASE_URL` (e.g. `/laser-gen/`) when deploying under a subpath, and add a
  `404.html` copy of `index.html` for client-side routing.

## Requirements

- Node.js ≥ 22, pnpm 11 (pinned via the `packageManager` field in `package.json`).
- No environment variables are required. AI provider keys are entered by each user in
  the app and stored only on their device — never on any server.
