use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures_util::future::{ok, LocalBoxFuture, Ready};
use std::rc::Rc;
use std::sync::OnceLock;

static URL_SCRUBBER: OnceLock<regex::Regex> = OnceLock::new();

fn scrub_url(url: &str) -> String {
    let re = URL_SCRUBBER.get_or_init(|| {
        regex::Regex::new(r"(?i)/([a-zA-Z0-9]+_[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)(/|$|\?)").unwrap()
    });
    re.replace_all(url, "/?$2").to_string()
}

pub struct EasyMonitorActix;

impl<S, B> Transform<S, ServiceRequest> for EasyMonitorActix
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = EasyMonitorMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(EasyMonitorMiddleware {
            service: Rc::new(service),
        })
    }
}

pub struct EasyMonitorMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for EasyMonitorMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let trace_id = req
            .headers()
            .get("x-easymonitor-trace-id")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        let parent_id = req
            .headers()
            .get("x-easymonitor-parent-id")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        let url_str = scrub_url(&req.uri().to_string());

        // Automatically inject trace span
        let span = tracing::info_span!(
            "http.server.request",
            http.method = %req.method(),
            http.url = %url_str,
            trace_id = trace_id,
            parent_id = parent_id
        );

        let srv = self.service.clone();
        use tracing::Instrument;
        Box::pin(async move {
            srv.call(req).instrument(span).await
        })
    }
}
