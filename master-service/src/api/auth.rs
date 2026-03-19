use axum::{
    extract::Request,
    http::{StatusCode, header},
    response::Response,
    middleware::Next,
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm, encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

pub async fn login_stub() -> Json<LoginResponse> {
    let claims = Claims {
        sub: "admin".to_owned(),
        role: "Admin".to_owned(),
        exp: 2999999999, // Safely expires very far into future globally
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"secret_phase_7_key")
    ).unwrap();
    Json(LoginResponse { token })
}

pub async fn require_jwt(mut req: Request, next: Next) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    let auth_header = if let Some(auth_header) = auth_header {
        auth_header
    } else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = &auth_header[7..];

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(b"secret_phase_7_key"),
        &Validation::new(Algorithm::HS256),
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;

    if token_data.claims.role != "Admin" && token_data.claims.role != "Observer" {
        return Err(StatusCode::FORBIDDEN);
    }

    req.extensions_mut().insert(token_data.claims);

    Ok(next.run(req).await)
}
