# INTEGRATIONS

## External Services & APIs
The easy-monitor application is largely self-contained but relies on several external integrations for standard operations:

- **Metrics Collection**: Uses `sysinfo` to aggregate system-level hardware metrics directly from the host os, functioning essentially as an integration point to native host OS counters.
- **Persistent Storage**: `sled` is used as an embedded key-value database. There's zero setup DB integration, keeping the dependency purely local.
- **Inter-service Communication**: Employs `tonic` (gRPC) over TLS (indicated by `certs` presence and `tonic` features) for strong-typed interactions between the master-service and node-agent elements.

## Authentication Providers
- Self-hosted stateless authentication via `jsonwebtoken`. Not integrated with external OAuth systems like Google or GitHub currently. The system presumably handles its own admin token issuing and validation processes.

## Webhooks
None currently detected in dependencies or base config.
