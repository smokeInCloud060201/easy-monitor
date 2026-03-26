# Phase 52 Research: OS Delta Span Profiling

## Objective
Record explicit CPU ticks and Memory allocation deltas per-span dynamically modeling execution costs matching individual HTTP and Database payloads globally.

## Node.js Implementation Approach
Node.js offers `process.cpuUsage()` and `process.memoryUsage().heapUsed` statically. 
Because `cpuUsage()` returns `{ user, system }` in microseconds natively tracking cumulative process time, calculating structural delta metrics across explicit Spans guarantees valid execution footprints organically.

We define a `CpuMemProfilingProcessor` implementing the OpenTelemetry `SpanProcessor`:
- `onStart`: `cache[span_id] = { cpu: process.cpuUsage(), mem: process.memoryUsage().heapUsed }`
- `onEnd`: `const deltaCpu = process.cpuUsage(cache.cpu); span.setAttribute("cpu.user", deltaCpu.user); cache.delete()`

## Go Implementation Approach
Go natively tracks metrics over `runtime.MemStats`. Executing GC allocation delta tracking allows granular profiling globally avoiding heavy `pprof` file mappings. We attach start limits locally inside `context`.

## Java Implementation Approach
Extract `java.lang.management.ManagementFactory.getThreadMXBean()`. Ensure `isThreadCpuTimeEnabled()` runs. 
During Servlet interception (`ServletAdvice`):
- `long cpuStart = threadBean.getCurrentThreadCpuTime();`
- Upon exit: Compute structural time mapping into `span.setAttribute("cpu.user", delta)`.

## Rust Implementation Approach
Rust does not have a native cross-platform `cpuUsage` built into `std`. To avoid importing massive dependencies like `sysinfo` per span which could degrade high-frequency APM performance significantly over Tokyo dispatchers, the Rust Profiling metrics will be isolated to native elapsed clock times explicitly or securely bypassed as optional natively preventing excessive syscall loops globally.
