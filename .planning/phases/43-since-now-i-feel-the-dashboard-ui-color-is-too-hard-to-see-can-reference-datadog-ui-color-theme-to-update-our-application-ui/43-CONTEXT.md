# Phase 43: Datadog UI Theme Update - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the application's UI theme, color palette, and styling to reference the Datadog UI. The goal is to improve readability and apply a professional, high-contrast, robust aesthetic across the dashboard.
</domain>

<decisions>
## Implementation Decisions

### Scope of Theme Update
- **Fully Overhaul Tailwind Config**: Do not just do inline class replacements. We will build a dedicated standard palette in `tailwind.config.js` with Semantic class names mimicking Datadog's cool grays, vibrant purples/blues, greens, etc.

### Light Mode vs Dark Mode
- **Theme Toggle Required**: Introduce a dark/light mode toggle to the dashboard. The dashboard must support both a Datadog-style light mode (e.g., crisp white backgrounds with strong bold text) and their distinct dark mode (`#1e1e24` space gray backgrounds).

### Typography & Contrast
- **Follow Datadog Strictly**: Apply strict typography scales, high-contrast text for metrics, and distinct font weights matching the Datadog experience.

### Claude's Discretion
- Exactly how the component classes (e.g., buttons, badges, tables, charts) map to the new Tailwind tokens. 
- The exact layout or icon for the theme toggle switch, provided it feels native to the dashboard.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Active Components
- `dashboard/tailwind.config.js` — The primary file where the DD theme scales and tokens must be defined.
- `dashboard/src/components/layout/*` — Where the new theme toggle component and unified global background classes will live.
- `dashboard/index.css` / `App.tsx` — Where global variable strategies (e.g., `class="dark"`) will be implemented and tied to state.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The dashboard already uses React Context or standard local state in some layout headers for navigation; the theme toggle can easily hook into a `ThemeProvider` or similar global context to toggle the `.dark` class on the root `.html` element.

### Established Patterns
- Most components currently rely heavily on hardcoded Tailwind utility classes (`bg-gray-900`, `text-blue-400`, `border-gray-800`). Transitioning to semantic DD theme classes (like `bg-dd-surface`, `text-dd-muted`, etc.) or simply replacing the standard `gray` palette with DD's hex codes in the Tailwind config are both viable paths. Due to the "Fully" decision, altering the base palette in `tailwind.config.ts` might be the cleanest way to globally impact existing components while setting a standard for new ones.

</code_context>

<specifics>
## Specific Ideas

- Focus heavily on legibility: Datadog's dark mode has excellent visual hierarchy using very subtle border colors and specifically contrasting typography for primary vs secondary information.

</specifics>

<deferred>
## Deferred Ideas

- None.

</deferred>

---

*Phase: 43-since-now-i-feel-the-dashboard-ui-color-is-too-hard-to-see-can-reference-datadog-ui-color-theme-to-update-our-application-ui*
*Context gathered: 2026-03-25*
