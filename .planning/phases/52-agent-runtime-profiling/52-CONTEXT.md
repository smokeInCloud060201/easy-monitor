# Phase 52: Agent Runtime Profiling (Optional)

## Objective
Continuous profiling of CPU and Memory constraints, mapping raw systemic allocation footprints directly to application HTTP endpoints and database invocations natively.

## The Challenge
True full-stack Continuous Profiling (like Datadog's flamegraphs) requires building custom native extensions across 4 languages analyzing C-level call stacks (`.pprof`, JVM JFR, V8 CPU profiles). This is extremely heavy and goes far beyond standard lightweight agent capabilities.

## The Solution: Lightweight Span Profiling
Instead of deep stack tracing, we can implement **Delta Span Profiling**. 
When a root web request or database query starts, the agent captures a snapshot of the active OS CPU ticks and active Memory Heap usages. When the span closes, it calculates the delta and attaches it natively to `span.metrics`.

### Language Approaches:

**Node.js**:
- Utilize `process.cpuUsage()` and `process.memoryUsage().heapUsed`.
- At Span start: `span.meta["_cpu_anchor"] = process.cpuUsage()`
- At Span end: `const cpu = process.cpuUsage(startCpu); span.metrics["cpu.user"] = cpu.user; span.metrics["cpu.system"] = cpu.system;`

**Go**:
- Go's `runtime.ReadMemStats` handles memory profiling. 
- Due to goroutines, capturing CPU is complex per-span. We will capture `mem.alloc` natively comparing alloc differences over `StartSpanFromContext` -> `span.End()`.

**Java**:
- Leverage `ThreadMXBean` to capture `getThreadCpuTime(Thread.currentThread().getId())` cleanly isolating exact CPU time spent ONLY on the active HTTP worker thread directly inside ByteBuddy Servlet bindings.

**Rust**:
- Native `std::time::ProcessTime` or ecosystem equivalents represent user CPU ticks. 

## Recommendation
Since Phase 52 is designated **(Optional)**, these lightweight deltas will completely satisfy the original milestone goal (associating profiling telemetry directly to application endpoint arrays) without requiring massive native binary module extensions.

_How would you like to proceed? Approve this lightweight delta-profiling strategy to generate the plans, or do you want to safely skip this optional milestone and wrap up the v1.0 deployment?_
