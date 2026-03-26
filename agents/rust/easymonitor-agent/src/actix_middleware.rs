use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures_util::future::{ok, LocalBoxFuture, Ready};
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
        // Automatically inject trace span
        let span = tracing::info_span!(
            "http.request",
            http.method = %req.method(),
            http.url = %req.uri()
        );

        let srv = self.service.clone();
        Box::pin(async move {
            let _enter = span.enter();
            srv.call(req).await
        })
    }
}
