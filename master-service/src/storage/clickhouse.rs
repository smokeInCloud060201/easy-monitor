use reqwest::Client;
use tracing::{info, error};

use super::CH_URL;

pub async fn initialize_clickhouse(client: &Client) -> anyhow::Result<()> {
    info!("Initializing ClickHouse schema definitions...");

    let create_logs = "
        CREATE TABLE IF NOT EXISTS easy_monitor_logs (
            trace_id String,
            span_id String DEFAULT '',
            service String,
            level String,
            message String,
            pod_id String,
            namespace String,
            node_name String,
            host String DEFAULT '',
            source String DEFAULT '',
            attributes String DEFAULT '{}',
            timestamp Int64
        ) ENGINE = MergeTree()
        ORDER BY (service, timestamp);
    ";

    // Idempotent migrations for existing tables
    let alter_logs_migrations = vec![
        "ALTER TABLE easy_monitor_logs ADD COLUMN IF NOT EXISTS span_id String DEFAULT ''",
        "ALTER TABLE easy_monitor_logs ADD COLUMN IF NOT EXISTS host String DEFAULT ''",
        "ALTER TABLE easy_monitor_logs ADD COLUMN IF NOT EXISTS source String DEFAULT ''",
        "ALTER TABLE easy_monitor_logs ADD COLUMN IF NOT EXISTS attributes String DEFAULT '{}'",
    ];

    let alter_traces_migrations = [
        "ALTER TABLE easy_monitor_traces ADD COLUMN IF NOT EXISTS attributes String DEFAULT '{}'",
    ];

    let create_traces = "
        CREATE TABLE IF NOT EXISTS easy_monitor_traces (
            trace_id String,
            span_id String,
            parent_id String,
            service String,
            name String,
            resource String,
            error Int8,
            status_code UInt16 DEFAULT 0,
            duration Int64,
            timestamp Int64
        ) ENGINE = MergeTree()
        ORDER BY (service, timestamp);
    ";

    let create_red_metrics = "
        CREATE TABLE IF NOT EXISTS easy_monitor_red_metrics (
            service String,
            resource String,
            timestamp Int64,
            requests Float64,
            errors Float64,
            duration_sum Float64,
            duration_avg Float64,
            duration_p50 Float64,
            duration_p95 Float64,
            duration_p99 Float64,
            count UInt64
        ) ENGINE = MergeTree()
        ORDER BY (service, resource, timestamp);
    ";

    let create_topology_edges = "
        CREATE TABLE IF NOT EXISTS easy_monitor_topology_edges (
            parent_service String,
            child_service String,
            timestamp Int64,
            call_count UInt64,
            error_count UInt64,
            p95_latency Float64
        ) ENGINE = MergeTree()
        ORDER BY (parent_service, child_service, timestamp);
    ";

    let create_profiles = "
        CREATE TABLE IF NOT EXISTS easy_monitor_profiles (
            service String,
            profile_type String,
            timestamp Int64,
            raw_data String
        ) ENGINE = MergeTree()
        ORDER BY (service, timestamp);
    ";

    client.post(CH_URL).body(create_logs.to_string()).send().await?.error_for_status()?;
    client.post(CH_URL).body(create_traces.to_string()).send().await?.error_for_status()?;
    client.post(CH_URL).body(create_red_metrics.to_string()).send().await?.error_for_status()?;
    client.post(CH_URL).body(create_topology_edges.to_string()).send().await?.error_for_status()?;
    client.post(CH_URL).body(create_profiles.to_string()).send().await?.error_for_status()?;

    // Run idempotent ALTER TABLE migrations for logs metadata columns
    for migration in alter_logs_migrations {
        let _ = client.post(CH_URL).body(migration.to_string()).send().await;
    }

    // Run idempotent ALTER TABLE migrations for traces metadata columns
    for migration in alter_traces_migrations {
        let _ = client.post(CH_URL).body(migration.to_string()).send().await;
    }
    
    info!("ClickHouse OLAP tables initialized (logs, traces, red_metrics).");

    // ─── Materialized Views for Read-Path (CQRS) ───
    initialize_materialized_views(client).await;

    Ok(())
}

/// Create ClickHouse materialized views for per-minute rollups.
/// These auto-aggregate raw tables into read-optimized summary tables.
/// MVs only process NEW inserts after creation.
async fn initialize_materialized_views(client: &Client) {
    info!("Initializing ClickHouse materialized views for CQRS read-path...");

    let mv_definitions = vec![
        // Per-minute log rollup by service and level
        "CREATE TABLE IF NOT EXISTS mv_logs_per_minute_tbl (
            service String,
            level String,
            minute DateTime,
            log_count UInt64
        ) ENGINE = SummingMergeTree()
        ORDER BY (service, level, minute)",

        "CREATE MATERIALIZED VIEW IF NOT EXISTS mv_logs_per_minute
        TO mv_logs_per_minute_tbl
        AS SELECT
            service,
            level,
            toStartOfMinute(toDateTime(intDiv(timestamp, 1000))) AS minute,
            count() AS log_count
        FROM easy_monitor_logs
        GROUP BY service, level, minute",

        // Per-minute trace rollup (request counts, error counts, latency stats)
        "CREATE TABLE IF NOT EXISTS mv_traces_per_minute_tbl (
            service String,
            resource String,
            minute DateTime,
            request_count UInt64,
            error_count UInt64,
            duration_sum Float64,
            duration_avg Float64,
            duration_min Float64,
            duration_max Float64
        ) ENGINE = SummingMergeTree()
        ORDER BY (service, resource, minute)",

        "CREATE MATERIALIZED VIEW IF NOT EXISTS mv_traces_per_minute
        TO mv_traces_per_minute_tbl
        AS SELECT
            service,
            resource,
            toStartOfMinute(toDateTime(intDiv(timestamp, 1000))) AS minute,
            count() AS request_count,
            countIf(error > 0) AS error_count,
            sum(duration) AS duration_sum,
            avg(duration) AS duration_avg,
            min(duration) AS duration_min,
            max(duration) AS duration_max
        FROM easy_monitor_traces
        GROUP BY service, resource, minute",
    ];

    for ddl in mv_definitions {
        match client.post(CH_URL).body(ddl.to_string()).send().await {
            Ok(resp) => {
                if !resp.status().is_success() {
                    let body = resp.text().await.unwrap_or_default();
                    error!("MV creation failed: {}", body);
                }
            }
            Err(e) => error!("MV creation request failed: {}", e),
        }
    }

    info!("ClickHouse materialized views initialized (mv_logs_per_minute, mv_traces_per_minute).");
}
