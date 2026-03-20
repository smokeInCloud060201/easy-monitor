use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{info, warn};
use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::SaltString,
    password_hash::rand_core::OsRng,
};

use super::CH_URL;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRecord {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub async fn initialize_users_table(client: &Client) -> anyhow::Result<()> {
    let create_users = "
        CREATE TABLE IF NOT EXISTS easy_monitor_users (
            id String,
            username String,
            password_hash String,
            role String,
            created_at Int64,
            updated_at Int64
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY (username);
    ";

    client.post(CH_URL).body(create_users.to_string()).send().await?.error_for_status()?;
    info!("ClickHouse users table initialized.");

    // Check if any users exist
    let count_query = "SELECT count() FROM easy_monitor_users FINAL";
    let response = client
        .post(CH_URL)
        .body(count_query.to_string())
        .send()
        .await?
        .text()
        .await?;

    let count: u64 = response.trim().parse().unwrap_or(0);

    if count == 0 {
        // Seed default admin account
        let password = "changeme";
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!("Failed to hash seed password: {}", e))?
            .to_string();

        let now = chrono::Utc::now().timestamp();
        let seed_user = json!({
            "id": "seed-admin",
            "username": "admin",
            "password_hash": hash,
            "role": "Admin",
            "created_at": now,
            "updated_at": now,
        });

        let insert_url = format!("{}&query=INSERT INTO easy_monitor_users FORMAT JSONEachRow", CH_URL);
        client
            .post(&insert_url)
            .body(format!("{}\n", seed_user))
            .send()
            .await?
            .error_for_status()?;

        warn!("⚠ Default admin account created with password 'changeme'. Change this immediately!");
    }

    Ok(())
}

pub async fn find_user_by_username(client: &Client, username: &str) -> anyhow::Result<Option<UserRecord>> {
    let query = format!(
        "SELECT id, username, password_hash, role, created_at, updated_at FROM easy_monitor_users FINAL WHERE username = '{}' LIMIT 1 FORMAT JSONEachRow",
        username.replace('\'', "\\'")
    );

    let response = client
        .post(CH_URL)
        .body(query)
        .send()
        .await?
        .text()
        .await?;

    let trimmed = response.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let user: UserRecord = serde_json::from_str(trimmed)?;
    Ok(Some(user))
}

pub async fn list_users(client: &Client) -> anyhow::Result<Vec<UserRecord>> {
    let query = "SELECT id, username, password_hash, role, created_at, updated_at FROM easy_monitor_users FINAL ORDER BY username FORMAT JSONEachRow";

    let response = client
        .post(CH_URL)
        .body(query.to_string())
        .send()
        .await?
        .text()
        .await?;

    let trimmed = response.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let users: Vec<UserRecord> = trimmed
        .lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();

    Ok(users)
}

pub async fn create_user(client: &Client, username: &str, password: &str, role: &str) -> anyhow::Result<UserRecord> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("Failed to hash password: {}", e))?
        .to_string();

    let now = chrono::Utc::now().timestamp();
    let id = format!("user-{}", now);

    let user = UserRecord {
        id: id.clone(),
        username: username.to_string(),
        password_hash: hash,
        role: role.to_string(),
        created_at: now,
        updated_at: now,
    };

    let row = json!({
        "id": user.id,
        "username": user.username,
        "password_hash": user.password_hash,
        "role": user.role,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    });

    let insert_url = format!("{}&query=INSERT INTO easy_monitor_users FORMAT JSONEachRow", CH_URL);
    client
        .post(&insert_url)
        .body(format!("{}\n", row))
        .send()
        .await?
        .error_for_status()?;

    Ok(user)
}

pub async fn delete_user(client: &Client, username: &str) -> anyhow::Result<()> {
    let query = format!(
        "ALTER TABLE easy_monitor_users DELETE WHERE username = '{}'",
        username.replace('\'', "\\'")
    );

    client
        .post(CH_URL)
        .body(query)
        .send()
        .await?
        .error_for_status()?;

    Ok(())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}
