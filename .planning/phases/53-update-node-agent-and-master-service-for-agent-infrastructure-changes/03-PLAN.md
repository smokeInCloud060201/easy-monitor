---
wave: 3
depends_on: ["01"]
files_modified:
  - node-agent/src/apm/http_receiver.rs
  - node-agent/src/forwarder/mod.rs
autonomous: true
requirements: []
---

# Plan 03 - Node Agent Ingestion mapping

<objective>
Adapt the `node-agent` to accept Profiling requests passing through native HTTP bounds buffering them through `Sled` WAL files routing them through `msgpackr` decodings properly to the backend.
</objective>

## Tasks

<task>
<id>53-03-01</id>
<title>Add Profiling HTTP Receiver Endpoints</title>
<action>
Provide a new Axum route `POST /profiling` inside `node-agent/src/apm/http_receiver.rs`. Receive `msgpackr` encoded flamegraphs from polyglot agents natively, append them structurally to the `wal::batch_insert_profiles` queues safely bypassing monolithic sync limits. 
</action>
<read_first>
- `node-agent/src/apm/http_receiver.rs`
</read_first>
<acceptance_criteria>
- `node-agent/src/apm/http_receiver.rs` defines a route `/profiling`.
- `cd node-agent && cargo check` passes perfectly.
</acceptance_criteria>
</task>

<task>
<id>53-03-02</id>
<title>Adapt node-agent gRPC Forwarder</title>
<action>
Update `node-agent/src/forwarder/mod.rs` to periodically dequeue `Profile` chunks sending them natively over TLS utilizing the updated `SyncProfiles` boundaries in `shared-proto`.
</action>
<read_first>
- `node-agent/src/forwarder/mod.rs`
</read_first>
<acceptance_criteria>
- `node-agent/src/forwarder/mod.rs` includes a mechanism for transmitting profiles via gRPC over the `TracesServiceClient` struct interfaces.
- `cd node-agent && cargo check` perfectly builds.
</acceptance_criteria>
</task>

## Verification
- Verify `cd node-agent && cargo check` completes without issues preventing type mismatches spanning the gRPC structures seamlessly organically.

<must_haves>
- [ ] `node-agent` implements HTTP profiling payloads naturally smoothly.
- [ ] Protobuf payloads forward Profiling structurally dependably.
</must_haves>
