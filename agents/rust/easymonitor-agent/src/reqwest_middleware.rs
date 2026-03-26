use reqwest::RequestBuilder;
use tracing_subscriber::registry::LookupSpan;
use crate::SpanData;

pub trait TracingReqwestExt {
    fn send_with_trace(self) -> RequestBuilder;
}

impl TracingReqwestExt for RequestBuilder {
    fn send_with_trace(mut self) -> RequestBuilder {
        let span = tracing::Span::current();
        
        // We use span.with_subscriber but practically in tracing it's simpler
        // to just use span.id() and fetch from the global registry if we want extensions.
        // However, standard tracing `Span::current()` doesn't expose extensions directly 
        // without a registry handle.
        // Since `SpanData` is inserted by DatadogTracingLayer, we can extract it if we have 
        // context. A simpler approach is that the application uses `tracing::Span::current()`
        // which has an ID.
        
        let id = span.id();
        
        let mut t_id = None;
        let mut s_id = None;
        if let Some(id) = id {
            tracing::dispatcher::get_default(|dispatch| {
                if let Some(registry) = dispatch.downcast_ref::<tracing_subscriber::Registry>() {
                    if let Some(span_ref) = registry.span(&id) {
                        if let Some(data) = span_ref.extensions().get::<SpanData>() {
                            t_id = Some(data.trace_id.to_string());
                            s_id = Some(data.span_id.to_string());
                        }
                    }
                }
            });
        }
        
        if let Some(tid) = t_id {
            self = self.header("x-easymonitor-trace-id", tid);
        }
        if let Some(sid) = s_id {
            self = self.header("x-easymonitor-parent-id", sid);
        }
        
        self
    }
}
