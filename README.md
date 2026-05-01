# Tour de Playground

A map of Wellington's playgrounds. Check them off as you ride.

State is shared — everyone on the same URL sees the same map.

## Running locally

1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in your keys
4. `npm run dev`

Without `VITE_WORKER_URL` set, check-offs are stored in localStorage only (Phase 1 mode).

## Refreshing playground data

```bash
npm run refresh-data
```

Fetches the WCC ArcGIS feed, merges with existing `playgrounds.json`, and prints a diff summary. Review then commit the result.

## Deploying the frontend

```bash
npm run deploy
```

Deploys to GitHub Pages at `https://kahchan.github.io/tour-de-playground`.

## Deploying the Worker

See [worker/README.md](worker/README.md) for one-time Cloudflare setup.

```bash
cd worker && npm run deploy
```

## Reset

Navigate to `/?reset=1` — a passphrase input will appear. The passphrase is stored as a Cloudflare Worker secret (`RESET_PASSPHRASE`).
