# Theme plan — 80s (light + dark)

Two modes, same 80s identity: teal and pink accents, no purple. Dark is the default experience (black base); light is white base with the same accent hues shifted for contrast.

The existing `darkMode` boolean already threads through `MapView` — extend it app-wide as a toggle stored in `localStorage`.

---

## Palette tokens

Defined as CSS custom properties in `src/index.css`. The `[data-theme="light"]` attribute on `<html>` overrides the dark defaults.

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--color-bg` | `#0a0a0a` | `#f2f2f2` | App background |
| `--color-surface` | `#111111` | `#ffffff` | Sidebar, cards, panels, popup |
| `--color-surface-2` | `#1a1a1a` | `#e8e8e8` | Inset surfaces, hover backgrounds |
| `--color-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | Dividers, input borders |
| `--color-text` | `#ffffff` | `#0a0a0a` | Primary text |
| `--color-muted` | `rgba(255,255,255,0.45)` | `rgba(0,0,0,0.45)` | Secondary text, counts, labels |
| `--color-teal` | `#00e5cc` | `#008f82` | Primary accent — unchecked markers, active buttons |
| `--color-teal-dim` | `rgba(0,229,204,0.15)` | `rgba(0,143,130,0.12)` | Hover states, active filter pills |
| `--color-teal-border` | `rgba(0,229,204,0.4)` | `rgba(0,143,130,0.4)` | Pill/badge borders |
| `--color-pink` | `#ff2d78` | `#d4005a` | Checked markers, destructive actions, highlights |
| `--color-pink-dim` | `rgba(255,45,120,0.15)` | `rgba(212,0,90,0.10)` | Checked item tint |
| `--color-error` | `#ff2d78` | `#d4005a` | Error banner |

> Teal and pink are darkened in light mode (`#00e5cc` → `#008f82`, `#ff2d78` → `#d4005a`) to maintain ≥ 4.5:1 contrast against the white surface.

---

## Dark mode toggle

- `darkMode` state lives in `App.tsx`, persisted to `localStorage` as `"theme"` (`"dark"` / `"light"`).
- On mount, read `localStorage.theme`; fall back to `prefers-color-scheme`.
- Setting state also sets `document.documentElement.dataset.theme` to `"light"` or `"dark"` so CSS variables update instantly.
- Pass `darkMode` down to `MapView` (already done) to switch MapTiler style.
- A toggle button lives in the top-left control cluster alongside Counter.

---

## MapTiler styles

| Mode | Style |
|---|---|
| Dark | `streets-v2-dark` (already wired) |
| Light | `outdoor-v2` (already the original default) |

---

## Map markers

Marker colours are set as JS constants in `MapView.tsx`, not via CSS variables (MapLibre paint properties don't read CSS vars). Pass `darkMode` prop and derive colours inline.

| Layer | Dark | Light |
|---|---|---|
| Unchecked circle | `#00e5cc` | `#008f82` |
| Checked circle | `#ff2d78` at 0.6 opacity | `#d4005a` at 0.6 opacity |
| Cluster circle | `#00e5cc` | `#008f82` |
| Tick / count text | `#ffffff` | `#ffffff` (contrast ok on teal/pink fill) |

---

## Component-by-component changes

### Sidebar (Sidebar.module.css)

| Element | Replaces | New token |
|---|---|---|
| `.sidebar` background | `#151655` | `var(--color-surface)` |
| `.suburbHeader` hover | `rgba(255,255,255,0.05)` | `var(--color-surface-2)` |
| `.filterToggleActive` | `#6c1ec5` purple | `var(--color-teal)` bg, `var(--color-bg)` text |
| `.dotChecked` | `#22c55e` green | `var(--color-pink)` |
| `.dot` border | `rgba(100,140,255,0.7)` | `var(--color-teal-border)` |
| `.itemBy` (checker name) | green | `var(--color-teal)` |
| `.enableBtn` | green tones | `var(--color-teal)` tones |
| `.resetConfirmBtn` | red | `var(--color-pink)` |
| All hardcoded `#ffffff` text | — | `var(--color-text)` |
| All hardcoded `rgba(255,255,255,…)` muted text | — | `var(--color-muted)` |

### Counter pill (Counter.module.css)

| Element | Dark | Light |
|---|---|---|
| Background | `#0a0a0a` | `#ffffff` |
| Text | `#ffffff` | `#0a0a0a` |
| Border | `1px solid var(--color-teal-border)` | same |

Use `var(--color-surface)` + `var(--color-text)` + `var(--color-teal-border)` directly.

### NameBadge (NameBadge.module.css)

Same as Counter — `var(--color-surface)` bg, `var(--color-text)`, `var(--color-teal-border)` border.

### MarkerPopup / NamePrompt / ResetPanel

Background → `var(--color-surface)`, borders → `var(--color-border)`. Primary action buttons → `var(--color-teal)`. Destructive / undo → `var(--color-pink)`. All text → `var(--color-text)` / `var(--color-muted)`.

### App error banner (App.module.css)

`#ef4444` → `var(--color-error)`.

---

## Route line (from routing plan)

| Mode | Colour |
|---|---|
| Dark | `#00e5cc` at 70% opacity, 3px |
| Light | `#008f82` at 80% opacity, 3px |

---

## Implementation notes

- All existing hardcoded hex values (`#151655`, `#6366F1`, `#6c1ec5`, `#22c55e`, `#3b82f6`, etc.) are removed from CSS modules — everything goes through tokens.
- MapLibre paint properties can't use CSS variables; pass `darkMode` as a prop and select colour constants in `MapView.tsx`.
- The `prefers-color-scheme` fallback means first-time visitors get their OS default automatically.
