use axum::{extract::{State, Path}, Json};
use serde::Serialize;
use std::collections::HashSet;

use super::ApiState;

#[derive(Serialize)]
pub struct ServicesResponse {
    pub services: Vec<String>,
}

#[derive(Serialize)]
pub struct ResourcesResponse {
    pub service: String,
    pub resources: Vec<String>,
}

pub async fn get_services(State(state): State<ApiState>) -> Json<ServicesResponse> {
    let mut services = HashSet::new();
    
    // We derive active services directly from the RED metrics keys: "apm.service:resource:rate"
    for entry in state.latest_metrics.iter() {
        let key = entry.key();
        if key.starts_with("apm.") {
            let parts: Vec<&str> = key[4..].split(':').collect();
            if !parts.is_empty() {
                services.insert(parts[0].to_string());
            }
        }
    }

    let mut services_vec: Vec<String> = services.into_iter().collect();
    services_vec.sort();

    Json(ServicesResponse { services: services_vec })
}

pub async fn get_resources(State(state): State<ApiState>, Path(service_name): Path<String>) -> Json<ResourcesResponse> {
    let mut resources = HashSet::new();
    
    for entry in state.latest_metrics.iter() {
        let key = entry.key();
        let prefix = format!("apm.{}:", service_name);
        if key.starts_with(&prefix) {
            let remainder = &key[prefix.len()..];
            let parts: Vec<&str> = remainder.split(':').collect();
            if !parts.is_empty() {
                resources.insert(parts[0].to_string());
            }
        }
    }

    let mut resources_vec: Vec<String> = resources.into_iter().collect();
    resources_vec.sort();

    Json(ResourcesResponse { service: service_name, resources: resources_vec })
}
