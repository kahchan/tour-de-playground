const ORS_MATRIX_URL =
  'https://api.openrouteservice.org/v2/matrix/cycling-mountain'
// Stay well under the ORS free-tier matrix limit (3500 pairs per request).
// Off-diagonal tiles send 2×BATCH_SIZE locations and BATCH_SIZE² pairs.
const BATCH_SIZE = 40
const CACHE_KEY = 'tdp:matrix:v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface MatrixCache {
  version: 1
  hash: string
  matrix: number[][]
  builtAt: number
}

function hashIds(pgs: { id: string }[]): string {
  return [...pgs]
    .map((p) => p.id)
    .sort()
    .join(',')
}

export function getCachedMatrix(pgs: { id: string }[]): number[][] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: MatrixCache = JSON.parse(raw)
    if (cached.version !== 1) return null
    if (cached.hash !== hashIds(pgs)) return null
    if (Date.now() - cached.builtAt > MAX_AGE_MS) return null
    return cached.matrix
  } catch {
    return null
  }
}

export function setCachedMatrix(
  pgs: { id: string }[],
  matrix: number[][],
): void {
  try {
    const entry: MatrixCache = {
      version: 1,
      hash: hashIds(pgs),
      matrix,
      builtAt: Date.now(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

async function fetchTile(
  allLocs: [number, number][],
  srcIdxs: number[],
  dstIdxs: number[],
  orsKey: string,
  out: number[][],
  signal?: AbortSignal,
): Promise<void> {
  // Send only the locations involved in this tile to stay within per-request size limits.
  const combined = [...new Set([...srcIdxs, ...dstIdxs])]
  const localOf = new Map(combined.map((gi, li) => [gi, li]))
  const locations = combined.map((gi) => allLocs[gi])
  const sources = srcIdxs.map((gi) => localOf.get(gi)!)
  const destinations = dstIdxs.map((gi) => localOf.get(gi)!)

  const res = await fetch(ORS_MATRIX_URL, {
    method: 'POST',
    headers: { Authorization: orsKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations,
      sources,
      destinations,
      metrics: ['duration'],
    }),
    signal,
  })
  if (!res.ok) throw new Error(`ORS matrix ${res.status}`)
  const data = await res.json()
  const durations: number[][] = data.durations
  for (let si = 0; si < srcIdxs.length; si++) {
    for (let di = 0; di < dstIdxs.length; di++) {
      out[srcIdxs[si]][dstIdxs[di]] = durations[si][di]
    }
  }
}

export async function buildMatrix(
  pgs: { id: string; lat: number; lng: number }[],
  orsKey: string,
  signal?: AbortSignal,
): Promise<number[][]> {
  const n = pgs.length
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  )
  const allLocs: [number, number][] = pgs.map((p) => [p.lng, p.lat])

  // Build list of (srcBatch, dstBatch) index arrays
  const batches: number[][] = []
  for (let i = 0; i < n; i += BATCH_SIZE) {
    batches.push(
      Array.from({ length: Math.min(BATCH_SIZE, n - i) }, (_, k) => i + k),
    )
  }

  // Run one source-batch at a time; destination batches in parallel within each group.
  for (const srcBatch of batches) {
    await Promise.all(
      batches.map((dstBatch) =>
        fetchTile(allLocs, srcBatch, dstBatch, orsKey, matrix, signal),
      ),
    )
  }

  return matrix
}
