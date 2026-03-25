# Phase 36: Logs page: delete fields menu, just show logs message and search input. Follow Graylog search syntax (key:"value" AND OR) - Research

## Goal
The UI should be stripped of all complex structural drop-downs (like Service Selection or Pod ID text fields). A single "Omnibar" must accept Graylog-style boolean search queries containing explicit field matching (`key:"value"`), generic un-keyed text (mapping to the `message` field), and capitalized boolean operators (`AND`, `OR`, `NOT`).

---

## Architectural Approach

Presently, `master-service/src/api/queries.rs` constructs its SQL via `build_logs_where_clauses` which linearly `AND`s together distinct payload properties (`service`, `level`, `pod_id`, `keyword`).

### 1. Unified Request Payload
We will alter `LogsQueryRequest` in Rust (and `fetchLogsEnhanced` in TS) to accept a single `query: Option<String>` alongside pagination fields, dropping all the disparate structural fields.

### 2. Rust-based Query Compiler (Lucene to ClickHouse SQL)
Because ClickHouse does not natively understand Lucene/Graylog syntax, `master-service` must act as the translation layer.
We will build a compilation function: `parse_graylog_to_sql(query: &str) -> String`.

**Parsing Rules (Prototype Scope):**
- **Tokenization:** 
  - Regex or basic string splitting can extract tokens. 
  - `field:"value"` translates to `field = 'value'`.
  - `field:value` translates to `field = 'value'`.
  - Prefix `NOT ` negates the following term (e.g. `NOT level:INFO` -> `level != 'INFO'`).
  - Raw words without colons (e.g. `failed`) translate to `message ILIKE '%failed%'`.
- **Booleans:**
  - `AND`, `OR` act as direct SQL concatenators.
  - An implicit space between terms (without an explicit AND/OR) defaults to `OR` as per Graylog documentation semantics.
- **Security:**
  - Standard SQL injection defense: Strip unescaped single quotes from values before injecting them into the ClickHouse interpolated string, or properly escape them.

### 3. Frontend Refactoring
- **`dashboard/src/pages/LogsExplorer.tsx`**:
  - Remove the `<select>` for Services.
  - Remove the `<input>` for Pod ID.
  - Retain the wide search bar, but update the placeholder to `Search Graylog syntax (e.g. level:ERROR AND message:"failed")...`.
  - Update `fetchLogsData` to strictly pass the raw string payload.

## Validation Architecture
- Run the dashboard and master-service.
- Enter `service:"payment-service" AND (level:ERROR OR message:"SocketException")`.
- The frontend should successfully render only filtered logs without needing explicit dropdowns.

## RESEARCH COMPLETE
