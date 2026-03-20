# Phase 4: Add Authentication Feature - Research

**Researched:** 2026-03-20
**Status:** Complete

## RESEARCH COMPLETE

## 1. Rust Authentication Crates

### Password Hashing: argon2
- **Crate:** `argon2` (pure Rust implementation of Argon2id)
- **Usage pattern:**
  ```rust
  use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
  use argon2::password_hash::SaltString;
  use argon2::password_hash::rand_core::OsRng;

  // Hash
  let salt = SaltString::generate(&mut OsRng);
  let hash = Argon2::default().hash_password(password.as_bytes(), &salt)?.to_string();

  // Verify
  let parsed = PasswordHash::new(&hash)?;
  Argon2::default().verify_password(password.as_bytes(), &parsed)?;
  ```
- **Storage:** Hash string includes algorithm params, salt, and hash — store the full PHC string in ClickHouse
- **Workspace dependency:** Add `argon2 = "0.5"` to workspace `Cargo.toml`

### JWT: jsonwebtoken (already present)
- **Already in workspace** as `jsonwebtoken.workspace = true`
- Current usage in `auth.rs` is correct but needs:
  - Secret externalization from hardcoded `b"secret_phase_7_key"` to env var
  - Real claims population from user record
  - Proper expiry calculation (currently `2999999999`)

## 2. ClickHouse User Table Design

### Current Storage Pattern
- ClickHouse accessed via raw HTTP through `reqwest::Client` at `http://localhost:8123`
- Schema created in `initialize_clickhouse()` using `CREATE TABLE IF NOT EXISTS`
- Data inserted using `INSERT ... FORMAT JSONEachRow`
- No query builder — raw SQL strings

### Proposed Users Table
```sql
CREATE TABLE IF NOT EXISTS easy_monitor_users (
    id String,
    username String,
    password_hash String,
    role String,
    created_at Int64,
    updated_at Int64
) ENGINE = MergeTree()
ORDER BY (username);
```

**Key considerations:**
- ClickHouse is an OLAP database, not ideal for frequent single-row lookups. However, for a small user table (<1000 users), performance is fine.
- The `MergeTree` engine handles deduplication via `OPTIMIZE TABLE ... FINAL` or `ReplacingMergeTree(updated_at)` for upserts
- **Recommendation:** Use `ReplacingMergeTree(updated_at)` so updates to user records (password changes, role changes) naturally deduplicate
- Query with `SELECT ... FROM easy_monitor_users FINAL WHERE username = ?` to get latest version

### Seed Admin Insert
```sql
INSERT INTO easy_monitor_users FORMAT JSONEachRow
{"id":"seed-admin","username":"admin","password_hash":"<argon2id_hash_of_changeme>","role":"Admin","created_at":1234567890,"updated_at":1234567890}
```

## 3. Backend Auth Flow Changes

### Current Architecture (auth.rs)
- `login_stub()` — GET handler, returns hardcoded admin token
- `require_jwt()` — Middleware extracts Bearer token, validates JWT, checks role, inserts Claims into request extensions
- Routes: `/api/v1/*` protected by middleware, `/api/v1/login` outside protection layer

### Required Changes
1. **`login_stub()` → `login()`**: Change to POST, accept `{ username, password }` JSON body, query ClickHouse for user, verify password with argon2, return JWT with real claims
2. **JWT secret:** Read from `JWT_SECRET` env var at startup, pass through app state
3. **Token expiry:** Calculate `exp` as current time + configurable duration (default: 8 hours)
4. **New endpoints needed:**
   - `POST /api/v1/auth/login` — Credential validation (replaces login_stub)
   - `GET /api/v1/auth/me` — Return current user info from JWT claims
   - `GET /api/v1/admin/users` — List all users (Admin only)
   - `POST /api/v1/admin/users` — Create user (Admin only)
   - `DELETE /api/v1/admin/users/:id` — Delete user (Admin only)
5. **Admin middleware:** New middleware layer for admin-only routes that checks `role == "Admin"`

### State Changes
- `ApiState` needs: `jwt_secret: String`, ClickHouse client for user queries
- JWT secret loaded in `main.rs` from env and passed to `start_api_gateway()`

## 4. Dashboard Auth Integration

### Current State
- `App.tsx` uses `react-router-dom` with nested routes under `MainLayout`
- `lib/api.ts` makes direct `fetch()` calls with NO auth headers
- `MainLayout` renders `Sidebar` + `Outlet` — no auth guards

### Required Changes

#### Auth Context (`contexts/AuthContext.tsx`)
```tsx
interface AuthState {
  token: string | null;
  user: { username: string; role: string } | null;
  isAuthenticated: boolean;
}
```
- Read token from localStorage on mount
- Decode JWT to extract user info (sub, role)
- Provide `login()`, `logout()` functions
- Check token expiry client-side

#### API Client Enhancement (`lib/api.ts`)
- Add `Authorization: Bearer <token>` header to all API calls
- Create a wrapper function that handles 401 responses → clear localStorage → redirect to login
- Centralize base URL (currently hardcoded `http://localhost:3000`)

#### Route Guards
- Wrap `MainLayout` route in an auth check
- If no valid token → redirect to `/login`
- Store intended destination for post-login redirect

#### New Components
- `pages/Login.tsx` — Centered card login form
- `components/layout/UserMenu.tsx` — Top-right dropdown with user info + logout
- `pages/Admin.tsx` — User management table (Admin only, hidden from Observer)

### Route Structure
```tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<AuthGuard />}>
    <Route element={<MainLayout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/logs" element={<Logs />} />
      <Route path="/traces/:traceId" element={<TraceDetail />} />
      <Route element={<AdminGuard />}>
        <Route path="/admin/users" element={<Admin />} />
      </Route>
    </Route>
  </Route>
</Routes>
```

## 5. CLI User Management

### Implementation Approach
- Add a CLI binary or subcommand to `master-service`
- Use `clap` for argument parsing
- Commands:
  ```
  easy-monitor add-user <username> --role <Admin|Observer>
  easy-monitor list-users
  easy-monitor delete-user <username>
  ```
- Connects directly to ClickHouse to manage user records
- Password prompted interactively (not as CLI argument for security)

### Alternative: Bootstrap Script
- A simpler approach: add a `POST /api/v1/admin/users` endpoint and use `curl` for user management
- This avoids adding `clap` dependency and a separate binary
- The seed admin account enables initial API access for creating more users

**Recommendation:** Use the API endpoint approach — simpler architecture, no new binary needed. The CLI can be added later if needed.

## 6. Security Considerations

### JWT Secret
- Must be at least 256 bits (32 bytes) for HS256
- Validate at startup: reject if `JWT_SECRET` is empty or too short
- For docker-compose: set in `.env` file or `environment:` section

### Password Policy
- No strict policy for MVP — just require non-empty
- Argon2id default params are secure enough (19 MB memory, 2 iterations)

### CORS
- Currently `CorsLayer::permissive()` — fine for development
- For production: restrict to actual dashboard origin

## 7. Validation Architecture

### Testable Acceptance Criteria
1. **Login flow:** POST `/api/v1/auth/login` with valid credentials returns 200 + JWT token
2. **Invalid login:** POST with wrong password returns 401
3. **Protected routes:** Requests without token return 401
4. **Token expiry:** Expired tokens return 401
5. **Admin routes:** Observer role gets 403 on admin endpoints
6. **Dashboard guard:** Unauthenticated users redirected to `/login`
7. **Seed admin:** First boot creates default admin user in ClickHouse
8. **User management:** Admin can create/list/delete users via API

---

*Phase: 04-add-authentication-feature*
*Research completed: 2026-03-20*
