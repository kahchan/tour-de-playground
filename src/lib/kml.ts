import type { FeatureCollection, LineString } from 'geojson'
import type { Playground } from '../types'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Concatenate leg coordinates in legIndex order, dropping the duplicate shared
// endpoint between consecutive legs. GeoJSON positions are [lng, lat, elev],
// which matches KML's lng,lat,alt order directly.
function routePathCoords(geoJSON: FeatureCollection<LineString>): number[][] {
  const legs = [...geoJSON.features].sort(
    (a, b) => (a.properties?.legIndex ?? 0) - (b.properties?.legIndex ?? 0),
  )
  const coords: number[][] = []
  for (const leg of legs) {
    for (const c of leg.geometry.coordinates) {
      const last = coords[coords.length - 1]
      if (last && last[0] === c[0] && last[1] === c[1]) continue
      coords.push(c)
    }
  }
  return coords
}

function coordString(c: number[]): string {
  return `${c[0]},${c[1]},${c[2] ?? 0}`
}

export function buildRouteKml(
  orderedPlaygrounds: Playground[],
  geoJSON: FeatureCollection<LineString> | null,
): string {
  const waypoints = orderedPlaygrounds
    .map((p, i) => {
      const name = escapeXml(`${i + 1}. ${p.name}`)
      return `    <Placemark>
      <name>${name}</name>
      <styleUrl>#waypoint</styleUrl>
      <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>
    </Placemark>`
    })
    .join('\n')

  const line = geoJSON
    ? `    <Placemark>
      <name>Route</name>
      <styleUrl>#route</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${routePathCoords(geoJSON).map(coordString).join(' ')}</coordinates>
      </LineString>
    </Placemark>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Tour de Playground</name>
    <Style id="route">
      <LineStyle><color>ffd7c800</color><width>4</width></LineStyle>
    </Style>
    <Style id="waypoint">
      <IconStyle><color>ffd0209b</color></IconStyle>
    </Style>
${line ? line + '\n' : ''}${waypoints}
  </Document>
</kml>
`
}

export function downloadKml(filename: string, kml: string): void {
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
