export interface Env {
  STATE: KVNamespace
  RESET_PASSPHRASE: string
}

interface CheckIn {
  id: string
  name: string
  ts: string
}

interface State {
  checks: CheckIn[]
  lastModified: string
}

const KV_KEY = 'state:current'

const ALLOWED_ORIGINS = [
  'https://kahchan.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
]

function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

async function getState(env: Env): Promise<State> {
  const raw = await env.STATE.get(KV_KEY)
  if (!raw) return { checks: [], lastModified: new Date().toISOString() }
  return JSON.parse(raw) as State
}

async function putState(env: Env, state: State): Promise<void> {
  await env.STATE.put(KV_KEY, JSON.stringify(state))
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''
    const headers = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    const { pathname } = new URL(request.url)

    if (request.method === 'GET' && pathname === '/state') {
      const state = await getState(env)
      return Response.json(state, {
        headers: { ...headers, 'Cache-Control': 'public, max-age=5' },
      })
    }

    if (request.method === 'POST' && pathname === '/check') {
      const body = await request.json<{ id?: string; name?: string }>()
      if (!body.id || !body.name) {
        return Response.json({ error: 'id and name required' }, { status: 400, headers })
      }

      const state = await getState(env)
      const existing = state.checks.find((c) => c.id === body.id)
      if (existing) {
        return Response.json(existing, { headers })
      }

      const checkIn: CheckIn = { id: body.id, name: body.name, ts: new Date().toISOString() }
      state.checks.push(checkIn)
      state.lastModified = checkIn.ts
      await putState(env, state)
      return Response.json(checkIn, { headers })
    }

    if (request.method === 'POST' && pathname === '/reset') {
      const body = await request.json<{ passphrase?: string }>()
      if (body.passphrase !== env.RESET_PASSPHRASE) {
        return Response.json({ error: 'wrong passphrase' }, { status: 403, headers })
      }

      const now = new Date().toISOString()
      await putState(env, { checks: [], lastModified: now })
      return Response.json({ ok: true, lastModified: now }, { headers })
    }

    return new Response('Not found', { status: 404, headers })
  },
}
