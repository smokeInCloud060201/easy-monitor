# UI-SPEC: Datadog-Style Design System Update

**Phase:** 11 — Update dashboard UI  
**Created:** 2026-03-21  
**Status:** APPROVED

---

## 1. Typography

### Font Stack
```
--font-sans: 'Inter', 'Noto Sans', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', Consolas, 'Liberation Mono', monospace;
```
Load Inter (weights 400, 500, 600, 700) from Google Fonts in `index.html`.

### Type Scale (Datadog-aligned)

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `page-title` | 20px | 700 | Page headers ("Logs", "APM Services") |
| `section-title` | 14px | 600 | Card/panel headers |
| `body` | 13px | 400 | General content, table cells |
| `body-strong` | 13px | 600 | Emphasis, nav items (active) |
| `caption` | 11px | 500 | Section labels, timestamps, metadata |
| `micro` | 10px | 500 | Footer text, version numbers |
| `code` | 12px | 400 | Log lines, trace IDs, code values (mono) |

### Rules
- All navigation items: **13px** (not 15px)
- Section headers (sidebar groups): **11px**, `UPPERCASE`, `letter-spacing: 0.08em`
- Page titles: **20px**, bold — always top-left of content area
- Log message text: **12px mono** for readability
- Table headers: **11px**, semibold, uppercase, muted color
- Numbers/metrics always use `font-variant-numeric: tabular-nums`

---

## 2. Color System

### Core Palette (already in `tailwind.config.js`)

| Token | Value | Use |
|-------|-------|-----|
| `background` | `#1a1a2e` | App background |
| `surface` | `#1e1e32` | Card/panel background |
| `surface-light` | `#252540` | Elevated surfaces, hovers |
| `surface-dark` | `#141428` | Header bar, sidebar |
| `brand` | `#632CA6` | Primary accent |
| `brand-light` | `#7c3aed` | Active states, highlights |
| `brand-dark` | `#4a1d80` | Pressed states |

### Semantic Colors

| Token | Value | Use |
|-------|-------|-----|
| `success` | `#22c55e` | Healthy status, OK badges |
| `warning` | `#f59e0b` | Warn badges, latency alerts |
| `danger` | `#ef4444` | Error badges, error rate |
| `info` | `#3b82f6` | Info badges, links |

### Text Colors

| Token | Use |
|-------|-----|
| `text-gray-100` | Primary text |
| `text-gray-300` | Secondary text |
| `text-gray-400` | Navigation items (inactive) |
| `text-gray-500` | Section labels, placeholders |
| `text-gray-600` | Disabled, footer text |

### Log Level Colors (Datadog convention)

| Level | Badge BG | Badge Text |
|-------|----------|------------|
| ERROR | `#ef4444/15%` | `#ef4444` |
| WARN | `#f59e0b/15%` | `#f59e0b` |
| INFO | `#3b82f6/15%` | `#3b82f6` |
| DEBUG | `#6b7280/15%` | `#9ca3af` |

---

## 3. Layout System

### Page Structure
```
┌─────────────────────────────────────────────────┐
│ Sidebar (240px) │ Content Area (flex-1)         │
│                 │ ┌─────────────────────────┐   │
│ Brand (56px)    │ │ Top Bar (48px)          │   │
│                 │ ├─────────────────────────┤   │
│ Nav groups      │ │ Page Content            │   │
│ (flex-1)        │ │ padding: 24px           │   │
│                 │ │                         │   │
│ Footer (44px)   │ │                         │   │
│                 │ └─────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Spacing Scale

| Token | Value | Use |
|-------|-------|-----|
| `page-px` | 24px | Content area horizontal padding |
| `page-py` | 24px | Content area top padding |
| `card-p` | 16px | Card/panel internal padding |
| `card-gap` | 16px | Gap between cards in a grid |
| `section-gap` | 24px | Gap between major page sections |
| `inline-gap` | 8px | Gap between inline elements |
| `tight-gap` | 4px | Gap between tightly coupled items |

### Breakpoints
- Sidebar: fixed 240px, does not collapse
- Content area: fluid, min-width 600px
- Card grids: use CSS grid with `minmax(320px, 1fr)` for auto-fit

---

## 4. Component Contracts

### Glass Panel (`.glass-panel`)
```css
background: rgba(30, 30, 50, 0.6);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.06);
border-radius: 12px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
```

### Status Badge
```
padding: 2px 8px;
border-radius: 4px;
font-size: 11px;
font-weight: 500;
background: {level-color}/15%;
color: {level-color};
border: 1px solid {level-color}/30%;
```

### Metric Card (Dashboard page)
```
.glass-panel
padding: 16px;
min-height: 120px;

Label: 11px, uppercase, gray-500
Value: 28px, font-weight 700, gray-100
Subtitle: 11px, gray-500
```

### Data Table (Logs, Traces, APM)
```
Header row: bg-surface-dark/50, text 11px uppercase gray-500, py-8px px-12px
Body row: text 13px gray-300, py-8px px-12px, border-b border-white/5
Row hover: bg-surface-light/40
Selected row: bg-brand/10, border-l-2 border-brand
```

### Search Bar
```
height: 36px;
background: surface;
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 8px;
font-size: 13px;
padding: 0 12px 0 36px; (icon-left layout)
placeholder color: gray-500;
focus: border-color brand/50, ring 2px brand/20
```

### Sidebar Navigation Item
```
Active:   bg-brand/10, text-brand-light, font-weight 600, left-border 2px brand
Inactive: text-gray-400, hover → bg-sidebar-hover text-gray-200
Size:     13px, py-8px, px-12px, gap-12px (icon-text)
Icon:     16px
```

---

## 5. Page-Specific Contracts

### Logs Page
```
Layout:
  ┌─ Search bar (full width, 36px) ─────────────────┐
  ├─ Histogram (140px height) ──────────────────────┤
  ├─ Filter chips row ──────────────────────────────┤
  ├─ Log table (flex-1, scrollable) ────────────────┤
  │  ├─ Timestamp (mono 12px, gray-500, 160px)
  │  ├─ Level badge (56px)
  │  ├─ Service (13px, truncated, 140px)
  │  └─ Message (mono 12px, flex-1, gray-300)
  └─ Detail panel (slide-from-right, 480px) ────────┘
```

### Traces Page
```
Layout:
  ┌─ Search + time picker ──────────────────────────┐
  ├─ Trace table ───────────────────────────────────┤
  │  ├─ Trace ID (mono 12px, brand-light, 120px)
  │  ├─ Service (13px, 140px)
  │  ├─ Resource (13px, truncated, flex-1)
  │  ├─ Duration (mono 12px, right-aligned, 80px)
  │  └─ Status badge (56px)
  └──────────────────────────────────────────────────┘

Span Waterfall:
  - Nested indentation: 24px per depth level
  - Duration bar: height 20px, border-radius 3px
  - Bar color: service-specific from a fixed palette
  - Error spans: danger color bar + error icon
```

### APM/Services Page
```
Layout:
  ┌─ Service header row ────────────────────────────┐
  ├─ RED metric cards (3-col grid) ─────────────────┤
  │  ├─ Request Rate (card)
  │  ├─ Error Rate (card)
  │  └─ Latency P95 (card)
  ├─ Endpoints table ───────────────────────────────┤
  └─ Dependency mini-map ───────────────────────────┘
```

### Dashboard Page
```
Layout:
  ┌─ Metric cards (auto-fit grid, 4 cols) ──────────┐
  ├─ Time series chart (full width, 280px) ─────────┤
  └─ Bottom section (optional) ─────────────────────┘
```

---

## 6. Interaction & Animation

### Transitions
- Default: `transition-all duration-200 ease-out`
- Sidebar hover: `transition-all duration-150`
- Panel fade in: `fadeIn 0.3s ease-out`
- Slide up (cards): `slideUp 0.3s ease-out`
- Scale in (modals): `scaleIn 0.2s ease-out`

### Hover States
- Cards: border shifts to `brand/30`, shadow elevates to `card-hover`
- Table rows: background shifts to `surface-light/40`
- Buttons: brightness +10%, slight scale (1.02)
- Nav items: background to `sidebar-hover`, text to `gray-200`

### Focus States
- Inputs: `border-brand/50` + `ring-2 ring-brand/20`
- Buttons: `outline-2 outline-brand/50 outline-offset-2`

### Loading States
- Skeleton: animated gradient `surface-dark → surface-light → surface-dark`
- Spinner: Lucide `Loader2` icon with `animate-spin`, 16px
- Tables: fade-out content + skeleton rows

---

## Design System Audit Checklist

- [x] Font family defined (Inter + JetBrains Mono)
- [x] Type scale with 7 tokens
- [x] Color palette with semantic tokens
- [x] Layout grid and spacing scale
- [x] Component contracts for 6 core components
- [x] Page layouts for 4 main views
- [x] Interaction and animation specs
- [x] Status/badge color mapping
- [x] Focus/hover/loading state specs

---

*UI-SPEC COMPLETE*
