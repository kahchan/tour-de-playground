# Theme plan — 80s

Black base, teal + pink pops, white text. Builds on the existing dark mode infrastructure in MapView (`darkMode` prop + `streets-v2-dark` MapTiler style).

## Palette

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#0a0a0a` | App background, sidebar |
| `--color-surface` | `#111111` | Cards, panels, popup |
| `--color-border` | `rgba(255,255,255,0.08)` | Dividers |
| `--color-teal` | `#00e5cc` | Primary accent — unchecked markers, active buttons, links |
| `--color-teal-dim` | `rgba(0,229,204,0.15)` | Hover states, active filter pills |
| `--color-pink` | `#ff2d78` | Secondary accent — checked markers, destructive/undo, highlights |
| `--color-pink-dim` | `rgba(255,45,120,0.15)` | Checked item backgrounds |
| `--color-white` | `#ffffff` | Primary text |
| `--color-muted` | `rgba(255,255,255,0.45)` | Secondary text, counts, labels |
| `--color-error` | `#ff2d78` | Error banner (reuse pink) |

## What changes where

### Map markers (MapView.tsx)

| Layer | Current | New |
|---|---|---|
| Unchecked circle | `#3B82F6` blue | `#00e5cc` teal |
| Checked circle | `#22C55E` green | `#ff2d78` pink, opacity 0.6 |
| Cluster circle | `#6366F1` indigo | `#00e5cc` teal |
| Tick symbol | white | white (no change) |
| Cluster count text | white | white (no change) |

### Sidebar (Sidebar.module.css)

| Element | Current | New |
|---|---|---|
| `.sidebar` background | `#151655` | `#0a0a0a` |
| `.filterToggleActive` | `#6c1ec5` purple | `#00e5cc` teal |
| `.dotChecked` | `#22c55e` green | `#ff2d78` pink |
| `.dot` border | `rgba(100,140,255,0.7)` | `rgba(0,229,204,0.7)` teal |
| `.itemBy` (checker name) | `rgba(100,220,140,0.8)` green | `rgba(0,229,204,0.8)` teal |
| `.enableBtn` | green tones | teal tones |
| `.resetConfirmBtn` / error tones | red | pink (`#ff2d78`) |

### Counter pill (Counter.module.css)

| Element | Current | New |
|---|---|---|
| Background | `rgba(255,255,255,0.92)` white | `#0a0a0a` |
| Text | `#1a1a1a` dark | `#ffffff` white |
| Border | none | `1px solid rgba(0,229,204,0.4)` teal |

### NameBadge (NameBadge.module.css)

Same treatment as Counter — black bg, white text, teal border.

### MarkerPopup / NamePrompt / ResetPanel

Background → `#111111`, borders → `rgba(255,255,255,0.08)`. Primary action buttons → teal. Destructive / undo → pink.

### App error banner (App.module.css)

`#ef4444` → `#ff2d78` pink.

### MapTiler style

Already wired: dark mode uses `streets-v2-dark`. That stays as-is — the black basemap complements the palette.

## Route line (from routing plan)

When the route feature is built, the route line colour should be `#00e5cc` teal at 70% opacity, 3px wide.

## Implementation notes

- Introduce CSS custom properties in `src/index.css` for the tokens above so all components reference variables, not hardcoded hex values.
- The existing `#151655` sidebar colour and `#6366F1` / `#6c1ec5` purples are fully replaced — nothing in the 80s palette is purple.
- Keep the `streets-v2-dark` MapTiler style; the black basemap already fits. No need for a custom map style.
