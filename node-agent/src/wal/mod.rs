use std::sync::Arc;
use anyhow::Result;
use sled::{Db, Tree};
use tokio::sync::Notify;
use tracing::{error, debug};
use shared_proto::metrics::MetricPayload;
use shared_proto::logs::LogEntry;
use shared_proto::traces::{Span, Profile};

const METRICS_TREE: &str = "metrics_v1";
const LOGS_TREE: &str = "logs_v1";
const TRACES_TREE: &str = "traces_v1";
const PROFILES_TREE: &str = "profiles_v1";

/// Kafka-style batch threshold: flush when any tree reaches this count.
pub const BATCH_THRESHOLD: usize = 1000;

#[derive(Clone)]
pub struct WalBuffer {
    _db: Db,
    metrics: Tree,
    logs: Tree,
    traces: Tree,
    profiles: Tree,
    /// Notifies the forwarder when any tree reaches BATCH_THRESHOLD.
    batch_notify: Arc<Notify>,
}

impl WalBuffer {
    pub fn new(path: &str) -> std::result::Result<Self, sled::Error> {
        let db = sled::open(path)?;
        let metrics = db.open_tree(METRICS_TREE)?;
        let logs = db.open_tree(LOGS_TREE)?;
        let traces = db.open_tree(TRACES_TREE)?;
        let profiles = db.open_tree(PROFILES_TREE)?;

        Ok(Self {
            _db: db,
            metrics,
            logs,
            traces,
            profiles,
            batch_notify: Arc::new(Notify::new()),
        })
    }

    fn generate_key(&self) -> Vec<u8> {
        // Simple monotonically increasing key for append-only behavior
        let time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        time.to_be_bytes().to_vec()
    }

    /// Check if any tree has reached the batch threshold and notify the forwarder.
    fn check_batch_threshold(&self, tree: &Tree, kind: &str) {
        let len = tree.len();
        if len >= BATCH_THRESHOLD {
            debug!("{} tree reached batch threshold ({}/{}), notifying forwarder", kind, len, BATCH_THRESHOLD);
            self.batch_notify.notify_one();
        }
    }

    pub async fn write_metric(&self, payload: MetricPayload) -> Result<()> {
        let key = self.generate_key();
        match rmp_serde::to_vec_named(&payload) {
            Ok(data) => {
                self.metrics.insert(key, data)?;
                self.check_batch_threshold(&self.metrics, "metrics");
            }
            Err(e) => error!("Failed to serialize metric: {}", e),
        }
        Ok(())
    }

    pub async fn write_log(&self, entry: LogEntry) -> Result<()> {
        let key = self.generate_key();
        match rmp_serde::to_vec_named(&entry) {
            Ok(data) => {
                self.logs.insert(key, data)?;
                self.check_batch_threshold(&self.logs, "logs");
            }
            Err(e) => error!("Failed to serialize log: {}", e),
        }
        Ok(())
    }

    pub async fn write_trace(&self, span: Span) -> Result<()> {
        let key = self.generate_key();
        match rmp_serde::to_vec_named(&span) {
            Ok(data) => {
                self.traces.insert(key, data)?;
                self.check_batch_threshold(&self.traces, "traces");
            }
            Err(e) => error!("Failed to serialize span: {}", e),
        }
        Ok(())
    }

    pub async fn write_profile(&self, profile: Profile) -> Result<()> {
        let key = self.generate_key();
        match rmp_serde::to_vec_named(&profile) {
            Ok(data) => {
                self.profiles.insert(key, data)?;
                self.check_batch_threshold(&self.profiles, "profiles");
            }
            Err(e) => error!("Failed to serialize profile: {}", e),
        }
        Ok(())
    }

    pub fn metrics_tree(&self) -> Tree { self.metrics.clone() }
    pub fn logs_tree(&self) -> Tree { self.logs.clone() }
    pub fn traces_tree(&self) -> Tree { self.traces.clone() }
    pub fn profiles_tree(&self) -> Tree { self.profiles.clone() }

    /// Returns the batch notification handle for the forwarder.
    pub fn batch_notify(&self) -> Arc<Notify> {
        self.batch_notify.clone()
    }
}
