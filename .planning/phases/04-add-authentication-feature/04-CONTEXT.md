# Phase 4: Add Authentication Feature - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current hardcoded login stub with real authentication. Includes credential validation, secure JWT handling, login UI on the dashboard, session management, role-based access enforcement, and a basic admin panel for user management. Agent-to-master gRPC authentication is explicitly out of scope.

</domain>

<decisions>
## Implementation Decisions

### Credential Management
- Users created via CLI command (e.g., `easy-monitor add-user admin@example.com --role Admin`), stored in ClickHouse
- Password hashing with Argon2id
- JWT signing secret sourced from `JWT_SECRET` environment variable — error on startup if not set
- Seed admin account (`admin` / `changeme`) created automatically on first boot, with a log warning to change default credentials

### Session Lifecycle
- JWT token expiry: 1-8 hours (medium duration — one re-login per work session)
- No refresh token mechanism — users simply re-login when token expires
- On token expiry (401 response), dashboard silently redirects to login page
- Token stored in browser localStorage
- Login endpoint changed from `GET /api/v1/login` to `POST /api/v1/login` with JSON body `{ "username": "...", "password": "..." }`

### Login UI Flow
- Centered card login form on dark background (Grafana/Datadog style)
- Failed login shows inline red error text: "Invalid username or password" — no lockout mechanism
- After successful login, redirect to last visited page (fallback to main dashboard)
- Logout via top-right user menu (avatar/icon dropdown showing current user info and logout button)

### Role-based Access
- Two roles: `Admin` and `Observer` (existing)
- `Observer` is read-only: can view all dashboards, traces, logs, metrics but cannot manage users or settings
- Admin-only features are hidden from Observer UI (not shown as disabled)
- Basic admin page in dashboard: table of users with ability to add/remove users and assign roles (Admin-only section)
- Node-agent gRPC ingestion remains unauthenticated for this phase

### Claude's Discretion
- Exact token expiry duration within the 1-8 hour range
- Login form field validation behavior (trim whitespace, focus management)
- Admin page table styling and interaction details
- Loading states during login submission
- User menu dropdown design details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Authentication Code
- `master-service/src/api/auth.rs` — Current login stub, JWT middleware (`require_jwt`), Claims struct with `{sub, role, exp}`
- `master-service/src/api/mod.rs` — Route layout showing protected routes under `/api/v1` and login endpoint placement

### Architecture
- `.planning/PROJECT.md` — Core constraints: "low-effort", "stateless JWTs", "no complex third-party OAuth"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `auth::require_jwt` middleware: Already extracts Bearer token, decodes JWT, checks role. Needs secret externalization and real user validation.
- `auth::Claims` struct: Already has `sub`, `role`, `exp` fields — good foundation.
- `auth::LoginResponse`: Already returns `{ token: String }`.

### Established Patterns
- Axum middleware layer for route protection — already applied to all `/api/v1` routes.
- `CorsLayer::permissive()` on the app — may need tightening for auth cookies but fine for localStorage approach.
- ClickHouse as the data store — user records will go here too.

### Integration Points
- `master-service/src/api/mod.rs` — Login route needs to change from GET to POST, add user management routes
- `dashboard/src/App.tsx` — Needs auth guard wrapper, login route, auth context provider
- Side navigation — Needs conditional rendering based on role for admin sections
- Top-right area of dashboard layout — New user menu component

</code_context>

<specifics>
## Specific Ideas

- Login page should feel like Grafana/Datadog — professional, centered card on dark background
- The user menu pattern (top-right dropdown) is consistent with how Datadog and most SaaS tools handle logout/user info

</specifics>

<deferred>
## Deferred Ideas

- Node-agent gRPC authentication (API keys per agent) — future phase
- Account lockout / rate limiting on failed logins — future enhancement
- Password reset / recovery flow — future phase

</deferred>

---

*Phase: 04-add-authentication-feature*
*Context gathered: 2026-03-20*
