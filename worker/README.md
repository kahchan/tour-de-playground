# Worker setup

One-time setup:

```bash
cd worker
npm install
wrangler login

# Create KV namespace — copy the IDs into wrangler.toml
npm run kv:create
# Also create a preview namespace:
wrangler kv namespace create STATE --preview

# Set the reset passphrase as a secret
npm run secret:reset
```

After updating `wrangler.toml` with the KV namespace IDs:

```bash
# Deploy
npm run deploy

# Local dev (talks to preview KV)
npm run dev
```

The Worker URL after deploy will be `https://tour-de-playground.<your-subdomain>.workers.dev`.
Add it to the frontend's `.env.local` as `VITE_WORKER_URL`.
