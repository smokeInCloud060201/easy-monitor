use axum::{
    extract::{Request, State},
    http::{StatusCode, header},
    response::Response,
    middleware::Next,
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm, encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::storage::users;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Serialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub role: String,
    pub created_at: i64,
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: String,
}

use super::ApiState;

pub async fn login(
    State(state): State<ApiState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    // 1. Query ClickHouse for user
    let user = users::find_user_by_username(&state.read_pool.client, &body.username)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // 2. Verify password with argon2
    if !users::verify_password(&body.password, &user.password_hash) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // 3. Generate JWT with real claims
    let exp = chrono::Utc::now().timestamp() as usize + (8 * 3600); // 8 hours
    let claims = Claims {
        sub: user.username,
        role: user.role,
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LoginResponse { token }))
}

pub async fn me(
    req: Request,
) -> Result<Json<Claims>, StatusCode> {
    let claims = req.extensions().get::<Claims>()
        .ok_or(StatusCode::UNAUTHORIZED)?
        .clone();
    Ok(Json(claims))
}

pub async fn require_jwt(
    State(state): State<ApiState>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok())
        .map(|s| s.to_string());

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
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;

    if token_data.claims.role != "Admin" && token_data.claims.role != "Observer" {
        return Err(StatusCode::FORBIDDEN);
    }

    req.extensions_mut().insert(token_data.claims);

    Ok(next.run(req).await)
}

pub async fn require_admin(
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let claims = req.extensions().get::<Claims>()
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if claims.role != "Admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}

// Admin endpoints
pub async fn list_users_handler(
    State(state): State<ApiState>,
) -> Result<Json<Vec<UserInfo>>, StatusCode> {
    let users = users::list_users(&state.read_pool.client)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_infos: Vec<UserInfo> = users.into_iter().map(|u| UserInfo {
        id: u.id,
        username: u.username,
        role: u.role,
        created_at: u.created_at,
    }).collect();

    Ok(Json(user_infos))
}

pub async fn create_user_handler(
    State(state): State<ApiState>,
    Json(body): Json<CreateUserRequest>,
) -> Result<Json<UserInfo>, StatusCode> {
    // Validate role
    if body.role != "Admin" && body.role != "Observer" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Check if user already exists
    if users::find_user_by_username(&state.read_pool.client, &body.username)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .is_some()
    {
        return Err(StatusCode::CONFLICT);
    }

    let user = users::create_user(&state.read_pool.client, &body.username, &body.password, &body.role)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(UserInfo {
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
    }))
}

pub async fn delete_user_handler(
    State(state): State<ApiState>,
    req: Request,
) -> Result<StatusCode, StatusCode> {
    let username = req.uri().path()
        .rsplit('/')
        .next()
        .ok_or(StatusCode::BAD_REQUEST)?
        .to_string();

    // Prevent deleting self
    if let Some(claims) = req.extensions().get::<Claims>() {
        if claims.sub == username {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    users::delete_user(&state.read_pool.client, &username)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}
