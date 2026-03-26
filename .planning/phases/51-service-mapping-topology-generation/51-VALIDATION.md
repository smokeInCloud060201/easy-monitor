# Phase 51 Validation Criteria

## Goal
Master Service correctly answers topology network requests dynamically.

## Steps
1. Insert mock distributed traces (Node -> Go -> Java) into the ingest pipeline.
2. Query the `GET /api/apm/topology` REST endpoint.
3. Assert that the returned JSON objects contain:
   - `source: "node-agent"` -> `target: "go-app"`
   - `source: "go-app"` -> `target: "java-spring"`
4. Check that `call_count` and `error_count` exactly match the mock quantities safely bypassing ingestion overhead.
