# STACK

## Languages
- Rust (Edition 2021, Version 1.75+)
- TypeScript
- HTML/CSS

## Runtime & Frameworks
- **Backend**: Rust native binaries. Asynchronous runtime configured via `tokio`.
- **API/Server**: `axum` for HTTP API, `tonic` for gRPC server.
- **Frontend**: Node.js ecosystem (`vite` for build/dev server, `react` 19.x for UI).

## Core Dependencies
**Backend (`master-service`, `node-agent`)**:
- `sled`: Embedded database for persistent storage
- `sysinfo`: System metrics collection
- `notify`: File system event monitoring
- `serde`, `rmp-serde`: Serialization
- `jsonwebtoken`: Authentication mechanism
- `tracing`, `tracing-subscriber`: Logging and instrumentation

**Frontend (`dashboard`)**:
- `react`, `react-router-dom`: UI and routing
- `tailwindcss`, `autoprefixer`: Styling
- `recharts`: Data visualization
- `axios`, `lucide-react`: Utilities and icons

## Configuration
- Root configuration managed by `Cargo.toml` as a Cargo workspace with members `master-service`, `node-agent`, `shared-proto`.
- Frontend configured via `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`, and ESLint configs.
- Containerization supported via `docker-compose.yml`.
