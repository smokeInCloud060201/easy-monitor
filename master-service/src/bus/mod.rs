use tokio::sync::{broadcast, mpsc};

use shared_proto::logs::LogEntry;
use shared_proto::metrics::MetricPayload;
use shared_proto::traces::Span;

/// Events for the processor broadcast channel (fan-out to trace_metrics, alerts, notifications).
/// This is kept for processors that need to observe ALL event types.
#[derive(Clone, Debug)]
pub enum Event {
    Metrics(Vec<MetricPayload>),
    Logs(Vec<LogEntry>),
    Traces(Vec<Span>),
    Alerts(String, String),
}

pub type EventBusTx = broadcast::Sender<Event>;
pub type EventBusRx = broadcast::Receiver<Event>;

/// Per-type write channels for high-throughput ingestion.
/// Each data type gets its own mpsc channel so trace storms can't block log writes.
#[derive(Clone)]
pub struct WriteChannels {
    pub logs_tx: mpsc::Sender<Vec<LogEntry>>,
    pub traces_tx: mpsc::Sender<Vec<Span>>,
    pub metrics_tx: mpsc::Sender<Vec<MetricPayload>>,
}

/// Receivers consumed by write-path batch writers (non-Clone, consumed once).
pub struct WriteReceivers {
    pub logs_rx: mpsc::Receiver<Vec<LogEntry>>,
    pub traces_rx: mpsc::Receiver<Vec<Span>>,
    pub metrics_rx: mpsc::Receiver<Vec<MetricPayload>>,
}

/// Initialize the complete channel system:
/// - Per-type mpsc channels for write-path (high capacity, drop-oldest at sender)
/// - Broadcast channel for processor fan-out (existing behavior)
pub fn init_channels() -> (WriteChannels, WriteReceivers, EventBusTx, EventBusRx) {
    // Write-path mpsc channels — high capacity for burst absorption
    let (logs_tx, logs_rx) = mpsc::channel(8192);
    let (traces_tx, traces_rx) = mpsc::channel(8192);
    let (metrics_tx, metrics_rx) = mpsc::channel(4096);

    // Processor broadcast — kept for fan-out to trace_metrics, alerts, notifications
    let (event_tx, event_rx) = broadcast::channel(1024);

    let write_channels = WriteChannels {
        logs_tx,
        traces_tx,
        metrics_tx,
    };

    let write_receivers = WriteReceivers {
        logs_rx,
        traces_rx,
        metrics_rx,
    };

    (write_channels, write_receivers, event_tx, event_rx)
}
