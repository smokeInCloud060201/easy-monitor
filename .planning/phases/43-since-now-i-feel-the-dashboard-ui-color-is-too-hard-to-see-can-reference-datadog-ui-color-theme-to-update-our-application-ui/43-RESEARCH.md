## RESEARCH COMPLETE

# Phase 43: Datadog UI Theme Update - Research

## 1. Domain Understanding
The phase objective is to fully overhaul the Tailwind configuration and components to match the highly legible, high-contrast Datadog UI theme, supporting both Light and Dark modes via a newly introduced theme toggle.

## 2. Codebase Scouting

### `tailwind.config.js` and `index.css`
Currently, the Tailwind config maps static hex values to semantic names like `background`, `surface`, and `text-primary`. These values are hardcoded to "Datadog Dark Mode" (e.g., `#151821`).
Because they are statically mapped in `tailwind.config.js`, using standard `dark:class` toggles doesn't easily swap out the base theme.

### `MainLayout.tsx` & `App.tsx`
`MainLayout.tsx` wraps the whole application in `bg-background text-gray-100`. Notice that `text-gray-100` uses the default Tailwind palette instead of the semantic `text-primary`. Many individual components likely rely on raw Tailwind classes (`gray-900`, `blue-500`, etc.) instead of the semantic classes. 

### Theme Toggling
A theme toggle does not currently exist. We need to create a context or simple global state (e.g. `ThemeContext`) and a toggle switch, likely in the `UserMenu` or `Sidebar`.

## 3. Implementation Strategy

### A. CSS Variables for Toggling
To support full theme swapping cleanly:
1. Update `index.css` to define CSS variables for light mode inside `:root` and dark mode inside `.dark`.
   - Datadog Light Mode: `bg: #ffffff`, `surface: #F3F4F5`, `text: #191B28`, `subtext: #4F5568`
   - Datadog Dark Mode: `bg: #1A1B20`, `surface: #202228`, `text: #FFFFFF`, `subtext: #8E93A3`
2. Update `tailwind.config.js` to reference these variables (e.g., `background: 'var(--color-bg)'`).

### B. Standardizing Component Classes
Components heavily use `bg-gray-900` or `text-gray-400`. We need to systematically replace default color palette usage with semantic tokens (`bg-background`, `bg-surface`, `text-primary`, `text-muted`) across major pages:
- APM Dashboards (`LatencyDistribution.tsx`, `ErrorsSection.tsx`, etc.)
- Logs Viewer (`LogViewer.tsx`, `LogDetailPanel.tsx`, `Logs.tsx`)
- Sidebar & Layout

### C. Creating the Theme Provider & Toggle
- Implement a `ThemeProvider` context in `dashboard/src/components/layout/ThemeContext.tsx`.
- Create a `ThemeToggle.tsx` component (sun/moon icon).
- Add it to the top-level app wrapper or layout header. The `html` tag should class-toggle `dark`.

## 4. Typography & Contrast Matches
Datadog specifically uses Inter/Roboto-like typefaces. `tailwind.config.js` font-sans already leads with `Inter`, which aligns well. We must make sure metric numbers utilize `font-mono` or `tabular-nums` appropriately to match Datadog's bold APM visual language.
