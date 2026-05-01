# Tour de Playground

A map of Wellington's playgrounds. Check them off as you ride.

State is shared — everyone on the same URL sees the same map.

## Running locally

1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and add your [MapTiler API key](https://cloud.maptiler.com/)
4. `npm run dev`

## Refreshing playground data

```bash
npm run refresh-data
```

Fetches the WCC ArcGIS feed, merges with existing `playgrounds.json`, and prints a diff summary. Review then commit the result.

## Deploying

```bash
npm run deploy
```

Deploys to GitHub Pages at `https://kahchan.github.io/tour-de-playground`.

> The Cloudflare Worker is deployed separately — see `worker/README.md` (Phase 2).
