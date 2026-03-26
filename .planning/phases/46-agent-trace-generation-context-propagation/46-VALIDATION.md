---
phase: 46
slug: agent-trace-generation-context-propagation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Multi-language (Go test, Jest, Cargo test, JUnit) |
| **Config file** | Respective language test configs |
| **Quick run command** | `go test ./agents/go/...` & `npm run test` & `cargo test` |
| **Full suite command** | N/A (E2E flow requires mock app boot) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run respective language unit tests
- **After every plan wave:** Boot mock-app and send test traffic
- **Before `/gsd-verify-work`:** End-to-end trace generation must be visible in node-agent logs
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 46-01-01 | 01 | 1 | Span Models | unit | `cargo test` | ❌ W0 | ⬜ pending |
| 46-02-01 | 02 | 1 | Header Inject | unit | `go test ...` | ❌ W0 | ⬜ pending |
| 46-03-01 | 03 | 2 | Context Ext/Inj | e2e | tcpdump / HTTP logs | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] HTTP trace mock servers or test utilities for Go/Rust/Node/Java to assert headers are correctly manipulated.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E Trace Linkage | Cross-service Parenting | Cross-process | Boot `mock-app` and make a `curl` request to checkout. Observe node-agent WAL logs to verify `trace_id` is identical across Node, Go, Rust, Java. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
