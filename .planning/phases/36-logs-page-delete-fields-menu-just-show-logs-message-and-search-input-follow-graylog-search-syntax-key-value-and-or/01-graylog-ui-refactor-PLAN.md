---
wave: 1
depends_on: []
files_modified:
  - "dashboard/src/pages/LogsExplorer.tsx"
  - "master-service/src/api/queries.rs"
autonomous: true
---

# Plan: Refactor Logs Explorer to single-input Graylog syntax

<objective>
Delete the dropdown and pod ID inputs in the React UI, leaving only a unified search bar. Back the unified bar with a custom Rust parsing engine in `master-service` that translates fundamental Graylog/Lucene queries into ClickHouse SQL filtering dynamically.
</objective>

<tasks>
<task>
  <description>Strip explicit filtering inputs from the React UI</description>
  <read_first>
    - dashboard/src/pages/LogsExplorer.tsx
  </read_first>
  <action>
    Modify `dashboard/src/pages/LogsExplorer.tsx` to remove the `<select>` for `services` and the `<input>` for `podId`.
    Update the remaining global `keyword` search bar to have placeholder: `"Search Graylog syntax (e.g. level:ERROR AND message:\"failed\")..."`.
    Widen the single unified search bar since there's now plenty of room.
  </action>
  <acceptance_criteria>
    - The `LogsExplorer.tsx` file contains only 1 input field.
    - `podId` and dropdown `select` controls are removed.
  </acceptance_criteria>
</task>

<task>
  <description>Update the master-service logs query interface payload</description>
  <read_first>
    - master-service/src/api/queries.rs
  </read_first>
  <action>
    In `master-service/src/api/queries.rs`, locate `LogsQueryRequest`. 
    Change the payload struct so it relies primarily on a `keyword: Option<String>` or rename it `query: Option<String>`, but keeping `keyword` is perfectly backwards compatible with `fetchLogsEnhanced`. Keep limit and offset.
  </action>
  <acceptance_criteria>
    - `LogsQueryRequest` simplifies its fields but retains explicit support for the singular search `keyword` payload.
  </acceptance_criteria>
</task>

<task>
  <description>Implement Lucene-to-ClickHouse AST lexical parser</description>
  <read_first>
    - master-service/src/api/queries.rs
  </read_first>
  <action>
    In `master-service/src/api/queries.rs` define:
    `fn parse_graylog_to_sql(query: &str) -> String`
    
    Implement a safe parser loop or regex matching strategy that:
    1. Splits the query by spaces while respecting double quotes (e.g., using `shlex` or a custom accumulator loop).
    2. Identifies operands: `AND`, `OR`, `NOT`.
    3. Translates field conditions: e.g. `level:ERROR` -> `level = 'ERROR'`, `message:"critical failure"` -> `message ILIKE '%critical failure%'`.
    4. Handles generic terms without colons: if a word has no colon, treat it as `message ILIKE '%term%'`.
    5. Returns the compiled `WHERE` clause string. Ensure single quotes injected from the user string are properly escaped (`.replace("'", "''")`) to prevent SQL injection.
  </action>
  <acceptance_criteria>
    - The `parse_graylog_to_sql` function correctly maps a Lucene-style boolean AST to standard SQL.
    - SQL injection vulnerabilities are handled.
  </acceptance_criteria>
</task>

<task>
  <description>Integrate parser into the query endpoint</description>
  <read_first>
    - master-service/src/api/queries.rs
  </read_first>
  <action>
    Update `query_logs` (and `log_histogram` if it shares the payload) to call `parse_graylog_to_sql(&payload.keyword.unwrap_or_default())` instead of the linear `build_logs_where_clauses`. Replace the `where_str` generation logic cleanly with the output of the parser.
  </action>
  <acceptance_criteria>
    - `query_logs` leverages the custom AST parser string for its core database query generation.
    - The project successfully compiles via `cargo check`.
  </acceptance_criteria>
</task>
</tasks>

<verification>
## Verification Steps
1. Boot the `dashboard` and `master-service`.
2. Browse to the Logs page.
3. Observe the minimalist UI.
4. Input complex queries (e.g., `level:ERROR AND message:"failed"`) and verify ClickHouse correctly returns the matching set.
</verification>

<must_haves>
- Custom grammar generation MUST correctly implement Graylog's implicit generic `OR` strategy for terms.
- ClickHouse syntax validity MUST NOT be broken by arbitrary unparsed strings.
</must_haves>
