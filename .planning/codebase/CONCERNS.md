# CONCERNS

## Technical Debt & Known Issues
- Currently, the application has minimal explicit TODOs (`shared-proto/proto/opentelemetry/proto/common/v1/common.proto` contains a minor note on definition structures).
- Testing infrastructure is not heavily parameterized or explicitly separated out in large integration suites; unit tests are preferred currently but could lack coverage for complex distributed scenarios.
- The use of `sled` for embedded storage might need to be evaluated if single-node storage limits are reached; scaling the `master-service` horizontally might require an external database depending on retention periods.

## Security Posture
- Authentication is handled via stateless JWTs. Token rotation mechanics and revocation lists might be necessary for hardened environments.
- gRPC communication uses TLS (certificates are present in `certs/`), which is good for point-to-point security between node-agents and the master-service over untrusted networks.

## Fragile Areas
- Depending on metrics volumes, the `wal` implementation in the `node-agent` might consume significant disk space if the `master-service` goes down for an extended period.
- Rate limiting and bounds checking on the gRPC endpoints might be missing, which could lead to resource exhaustion under heavy load.
