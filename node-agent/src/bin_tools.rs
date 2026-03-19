fn main() { println!("TraceService Name: {}", shared_proto::opentelemetry::proto::collector::trace::v1::trace_service_server::TraceServiceServer::<crate::apm::OTLPReceiver>::NAME); }
