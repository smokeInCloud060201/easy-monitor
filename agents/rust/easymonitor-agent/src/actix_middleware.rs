use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures_util::future::{ok, LocalBoxFuture, Ready};
use opentelemetry::global;
use opentelemetry::propagation::Extractor;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use std::rc::Rc;

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

struct HeaderExtractor<'a>(&'a actix_web::http::header::HeaderMap);

impl<'a> Extractor for HeaderExtractor<'a> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|v| v.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(|k| k.as_str()).collect()
    }
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
        let parent_cx = global::get_text_map_propagator(|prop| {
            prop.extract(&HeaderExtractor(req.headers()))
        });
        tracing::Span::current().set_parent(parent_cx);

        let srv = self.service.clone();
        Box::pin(async move {
            srv.call(req).await
        })
    }
}
