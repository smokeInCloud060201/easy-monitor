use anyhow::Result;
use sled::{Db, Tree};
use tracing::error;
use shared_proto::metrics::MetricPayload;
use shared_proto::logs::LogEntry;
use shared_proto::traces::Span;

const METRICS_TREE: &str = "metrics_v1";
const LOGS_TREE: &str = "logs_v1";
const TRACES_TREE: &str = "traces_v1";

#[derive(Clone)]
pub struct WalBuffer {
    _db: Db,
    metrics: Tree,
    logs: Tree,
    traces: Tree,
}

impl WalBuffer {
    pub fn new(path: &str) -> std::result::Result<Self, sled::Error> {
        let db = sled::open(path)?;
        let metrics = db.open_tree(METRICS_TREE)?;
        let logs = db.open_tree(LOGS_TREE)?;
        let traces = db.open_tree(TRACES_TREE)?;

        Ok(Self {
            _db: db,
            metrics,
            logs,
            traces,
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

    pub async fn write_metric(&self, payload: MetricPayload) -> Result<()> {
        let key = self.generate_key();
        match rmp_serde::to_vec_named(&payload) {
            Ok(data) => {
                self.metrics.insert(key, data)?;
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
            }
            Err(e) => error!("Failed to serialize span: {}", e),
        }
        Ok(())
    }

    pub fn metrics_tree(&self) -> Tree { self.metrics.clone() }
    pub fn logs_tree(&self) -> Tree { self.logs.clone() }
    pub fn traces_tree(&self) -> Tree { self.traces.clone() }
}
