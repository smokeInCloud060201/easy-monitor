# CONVENTIONS

## Code Style
- **Backend (Rust)**:
  - Strongly typed, idiomatic Rust.
  - Formatted using `rustfmt` and linted by `clippy`.
  - Heavy reliance on asynchronous patterns with `tokio`. Error handling typically leveraging `Result` or `anyhow::Result`.
  - Logging is standardized using `tracing` macros instead of generic println.

- **Frontend (TypeScript/React)**:
  - TypeScript strict mode enabled (`tsconfig.app.json`, `tsconfig.node.json`).
  - ESLint configured for code quality (`eslint.config.js`), specifically utilizing React Hooks plugins and fast refresh.
  - Functional components with Hooks exclusively.
  - Styling via Tailwind CSS utility classes; PostCSS configuration.

## Commit Patterns
- GSD-based workflows suggest small, incremental commits with descriptive prefixes (e.g. `docs:`, `feat:`).

## Error Handling
- Context-rich error bubbling in backend services. `master-service` and `node-agent` handle disconnections robustly (using Write-Ahead Log in node-agent to buffer telemetry events when master is unreachable).
- Frontend leverages functional error state management (React Error Boundaries / React Router standard error parsing).
