#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'public', 'playgrounds.json')

// Parks/Parks MapServer, layer 49 — WCC Playgrounds
const WCC_ENDPOINT =
  'https://gis.wcc.govt.nz/arcgis/rest/services/Parks/Parks/MapServer/49/query' +
  '?where=1%3D1&outFields=*&f=geojson'

async function fetchPlaygrounds() {
  const res = await fetch(WCC_ENDPOINT)
  if (!res.ok) throw new Error(`WCC fetch failed: ${res.status} ${res.statusText}`)
  return res.json()
}

function toPlayground(feature) {
  const { properties, geometry } = feature
  const [lng, lat] = geometry.coordinates
  return {
    id: `wcc-${properties.OBJECTID}`,
    name: properties.Asset_Description ?? `Playground ${properties.OBJECTID}`,
    lat,
    lng,
    source: 'wcc',
    included: true,
  }
}

function loadExisting() {
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
  } catch {
    return []
  }
}

function merge(existing, incoming) {
  const existingById = new Map(existing.map((p) => [p.id, p]))
  const incomingIds = new Set(incoming.map((p) => p.id))

  const added = []
  const updated = []
  const removed = []

  const merged = incoming.map((fresh) => {
    const prev = existingById.get(fresh.id)
    if (!prev) {
      added.push(fresh.name)
      return fresh
    }
    // Preserve included flag and any hand-edits; take fresh coords/name from source
    const next = { ...fresh, included: prev.included }
    if (prev.name !== fresh.name || prev.lat !== fresh.lat || prev.lng !== fresh.lng) {
      updated.push(fresh.name)
    }
    return next
  })

  // Flag entries no longer in the source — don't delete, just mark
  for (const prev of existing) {
    if (!incomingIds.has(prev.id)) {
      removed.push(prev.name)
      merged.push({ ...prev, included: false, removedFromSource: true })
    }
  }

  return { merged, added, updated, removed }
}

async function main() {
  console.log('Fetching WCC playground data…')
  const geojson = await fetchPlaygrounds()

  if (!geojson.features?.length) {
    throw new Error('No features returned — check the endpoint URL')
  }
  console.log(`  ${geojson.features.length} features received`)

  // Log first feature's properties so field names can be verified
  if (process.argv.includes('--inspect')) {
    console.log('\nFirst feature properties:')
    console.log(JSON.stringify(geojson.features[0].properties, null, 2))
    console.log('\nFirst feature geometry:')
    console.log(JSON.stringify(geojson.features[0].geometry, null, 2))
    process.exit(0)
  }

  const incoming = geojson.features
    .filter((f) => f.geometry?.type === 'Point')
    .map(toPlayground)

  const existing = loadExisting()
  const { merged, added, updated, removed } = merge(existing, incoming)

  writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('\nDiff summary:')
  console.log(`  + ${added.length} added`)
  if (added.length) added.forEach((n) => console.log(`      ${n}`))
  console.log(`  ~ ${updated.length} updated (coords/name from source)`)
  if (updated.length) updated.forEach((n) => console.log(`      ${n}`))
  console.log(`  - ${removed.length} removed from source (marked included: false)`)
  if (removed.length) removed.forEach((n) => console.log(`      ${n}`))
  console.log(
    `\n  Total: ${merged.length} playgrounds` +
      ` (${merged.filter((p) => p.included).length} included)`,
  )
  console.log(`\nWritten to ${OUTPUT_PATH}`)
  console.log('Review the diff, then: git add public/playgrounds.json && git commit')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
