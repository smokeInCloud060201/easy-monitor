# Project Retrospective

## Cross-Milestone Trends

| Milestone | Phases | Timeline | Score | Key Lessons |
|-----------|--------|----------|-------|-------------|
| v1.0 | 3 | ~2 days | 9/9 | Single container React/Rust embedding is vastly simpler than NGINX proxies. |

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-20
**Phases:** 3 | **Plans:** 7

### What Was Built
- Phase 1: Built a unified React SPA (Dashboard) featuring Recharts metric visualization and a `react-virtuoso` live-tail log viewer.
- Phase 2: Implemented a recursive CSS Grid Span Waterfall charting UI for visualizing distributed traces.
- Phase 3: Packaged the entire platform, including the UI compiled directly into the Rust API Gateway, into a frictionless `docker-compose.yml` stack with ClickHouse orchestration.

### What Worked
- **Embedded UI**: Compiling the React Vite bundle and serving it directly via `tower-http` `ServeDir` in Rust eliminated complex CORS and NGINX routing proxy issues, enabling the true "Zero-Config" constraint.
- **Trace Visualization**: Utilizing CSS Grid for the hierarchical Span Waterfall proved extremely effective for arbitrary depth rendering without pulling in heavy canvas dependencies like D3.

### What Was Inefficient
- **Mock Generators**: Relying purely on mock data for the initial phases limited real-world stress testing until Phase 3 orchestration.

### Patterns Established
- UI state drives backend time queries explicitly via a shared `useTimeRange` URL hook context, ensuring synchronization.
- All deployments MUST target `debian-slim` multi-stage containers to preserve lightweight footprint.

### Key Lessons
- ClickHouse integration requires careful port mappings (8123 HTTP vs 9000 Native) and high `ulimits` for file descriptors in Docker.
- Recursive nested React components are the ideal lightweight solution for tracing waterfalls.
