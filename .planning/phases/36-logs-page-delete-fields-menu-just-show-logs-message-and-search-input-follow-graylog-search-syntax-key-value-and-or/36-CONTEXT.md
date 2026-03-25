# Phase 36: Logs page: delete fields menu, just show logs message and search input. Follow Graylog search syntax (key:"value" AND OR) - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the React Logs UI to have an extremely minimalistic footprint:
1. Strip out the dedicated filters (Service Dropdown, Pod ID input).
2. Retain a single unified "Omnibar" search input.
3. Replace basic keyword searching with Graylog/Lucene syntax parsing.

</domain>

<decisions>
## Implementation Decisions

### Scope & Behavior
- Only **1 input field** continues to exist on the Logs page.
- The input accepts Graylog query strings like `service:"payment-service" AND level:ERROR OR message:"failed"`.
- The user query determines filtering for `service`, `pod_id`, `level`, and arbitrary `tags` keys.

### Claude's Discretion
- **Parser Location**: Should the frontend cleanly parse the Graylog AST and convert it to a structured backend payload, or should the Rust backend parse the raw Lucene string directly into a ClickHouse SQL `WHERE` clause using a crate or custom lexer? (The backend parsing is closer to Datadog/Graylog architectures where the backend resolves the AST to the SQL dialect).
- **Supported Operators**: Initial support for `AND`, `OR`, `NOT`, and `()` grouping.

</decisions>

<canonical_refs>
## Canonical References

- [Graylog Search Syntax Rules](https://go2docs.graylog.org/current/interact_with_your_log_data/search_query_language.html)
  - `field:value` (exact match)
  - `field:"exact value"` (exact phrase)
  - `AND`, `OR`, `NOT` MUST be capitalized.
  - Implicit space means `OR`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dashboard/src/pages/LogsExplorer.tsx`: Contains the UI that will be stripped down.
- `master-service/src/apm.rs` (`get_logs_enhanced`): Contains the existing ClickHouse click-query generation logic that currently blindly accepts `service` and `pod_id` from query parameters.

</code_context>

<specifics>
## Specific Ideas
- To keep things simple in a prototype, a Rust `nom` parser or regex tokenizer can translate `service:"foo"` to `service = 'foo'`.

</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>

---

*Phase: 36-logs-page-delete-fields-menu*
*Context gathered: 2026-03-25*
