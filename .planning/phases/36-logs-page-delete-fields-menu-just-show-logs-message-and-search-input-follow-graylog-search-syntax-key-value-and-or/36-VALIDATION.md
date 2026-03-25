# Phase 36: logs-page-delete-fields-menu-just-show-logs-message-and-search-input - Validation Strategy

**Status:** Draft
**Nyquist Dimensions:** (1-7 covered by tests, 8 defined here)

<dimension8>
## Validation Architecture

The implementation will be manually validated by interacting with the newly refactored single-bar UI.

1. **Frontend Aesthetic**
   - Boot the `dashboard` UI containing the refactored `LogsExplorer.tsx`.
   - Verify the "Service" dropdown and "Pod ID" text inputs have been completely removed, leaving only the primary search bar and refresh button.

2. **Backend Syntax Translator**
   - Submit standard implicit `OR` syntax queries like `error exception`. It MUST return logs with `error` or `exception` anywhere in the message body.
   - Submit a complex keyed query: `level:ERROR AND service:"payment-service"`.
     - The ClickHouse database MUST parse this properly without 500ing.
     - The result set MUST exclusively contain rows where `level == 'ERROR'` AND `service == 'payment-service'`.
   - Submit a negative condition: `NOT level:INFO`. The result set MUST strictly exclude the INFO logs.

3. **No Database Injection**
   - Submit an unescaped, intentionally broken literal string: `service:"foo' OR 1=1"`. The parser MUST handle this resiliently by escaping the clickhouse single quotes or failing cleanly, avoiding SQL injection exploitation.

</dimension8>

---

*Phase: 36-logs-page-delete-fields-menu*
*Strategy created: 2026-03-25*
