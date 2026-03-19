pub mod metrics {
    tonic::include_proto!("easy_monitor.metrics");
}

pub mod logs {
    tonic::include_proto!("easy_monitor.logs");
}

pub mod traces {
    tonic::include_proto!("easy_monitor.traces");
}
