---
phase: 53
slug: update-node-agent-and-master-service-for-agent-infrastructure-changes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust `cargo test` / Node `vitest` |
| **Config file** | `master-service/Cargo.toml`, `node-agent/Cargo.toml` |
| **Quick run command** | `cargo check` |
| **Full suite command** | `make test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo check` in the modified crate
- **After every plan wave:** Run `make test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 53-01-01 | 01 | 1 | Schema | unit | `cd shared-proto && cargo check` | ✅ | ⬜ pending |
| 53-01-02 | 01 | 1 | DB-Table | integration | `curl -s localhost:8123` | ✅ | ⬜ pending |
| 53-02-01 | 02 | 2 | CQRS | unit | `cd master-service && cargo test processors` | ❌ W0 | ⬜ pending |
| 53-03-01 | 03 | 3 | Sled | unit | `cd node-agent && cargo test wal` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `master-service/src/processors/trace_metrics.rs` — tests for CQRS topology building.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E Tracing Integration | Full integration of Phase 45-52 payloads | Requires polyglot mock apps | Run `make run-mock-apps`, trigger traffic, query ClickHouse for `easy_monitor_topology_edges` and `easy_monitor_profiles`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
