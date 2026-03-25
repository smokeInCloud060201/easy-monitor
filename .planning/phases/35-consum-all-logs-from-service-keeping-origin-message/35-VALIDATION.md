# Phase 35: consum-all-logs-from-service-keeping-origin-message - Validation Strategy

**Status:** Draft
**Nyquist Dimensions:** (1-7 covered by tests, 8 defined here)

<dimension8>
## Validation Architecture

The implementation will be validated through manual and automated log tracing verification using the actual built infrastructure.

1. **Service Raw Log Emission**
   - Boot the `mock-app` using `./start.sh` so all polyglot microservices route their standard output/error to `.logs/*.log`.
   - Ensure the `order-service` or `payment-service` throws an actual stack trace (e.g., `java.net.SocketException`).

2. **Tailer Ingestion & Bundling**
   - Verify that `node-agent` is actively tailing `mock-app/.logs/*.log`.
   - Ensure the new File Tailer properly captures multi-line traces (indentation clustering) instead of shattering them into fragmented individual log lines.

3. **APM UI Render Fidelity**
   - Open the APM UI `http://localhost:5173/logs` in the browser.
   - Search for the dumped SocketException.
   - The log message MUST appear completely unmodified, retaining all original spacing, indentation, and structure emitted by the JVM/Node environment without JSON truncation.

</dimension8>

---

*Phase: 35-consum-all-logs-from-service-keeping-origin-message*
*Strategy created: 2026-03-25*
