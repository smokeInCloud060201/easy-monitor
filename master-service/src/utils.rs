/// Utility functions for the master-service.

/// Sanitize a span resource or name by replacing dynamic tokens with `?`.
///
/// Replaces:
/// - UUID patterns: `550e8400-e29b-41d4-a716-446655440000` → `?`
/// - Pure numeric sequences (3+ digits): `12345` → `?`
/// - Hex/alphanum IDs (8+ hex chars): `a1b2c3d4e5f6` → `?`
/// - Prefixed IDs after separators: `txn_1774095094` → `?`, `pay_abc123` → `?`
/// - Path segments that are numeric: `/users/123/orders` → `/users/?/orders`
///
/// Preserves operation prefixes like `cache.GET`, `SELECT`, `HTTP POST`.
///
/// # Examples
/// ```
/// assert_eq!(sanitize_resource("cache.GET txn:txn_1774095094"), "cache.GET txn:?");
/// assert_eq!(sanitize_resource("/api/users/12345/orders"), "/api/users/?/orders");
/// assert_eq!(sanitize_resource("SELECT * FROM users WHERE id = 42"), "SELECT * FROM users WHERE id = ?");
/// ```
pub fn sanitize_resource(resource: &str) -> String {
    let mut result = String::with_capacity(resource.len());
    let chars: Vec<char> = resource.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        // Check for UUID pattern: 8-4-4-4-12 hex chars
        if i + 36 <= len && is_uuid_at(&chars, i) {
            result.push('?');
            i += 36;
            continue;
        }

        // At a word boundary, check the upcoming token
        if i == 0 || is_separator(chars[i - 1]) {
            let token_end = find_token_end(&chars, i);
            let token: String = chars[i..token_end].iter().collect();

            if should_replace_token(&token) {
                result.push('?');
                i = token_end;
                continue;
            }
        }

        result.push(chars[i]);
        i += 1;
    }

    result
}

fn is_separator(c: char) -> bool {
    matches!(c, ' ' | '/' | ':' | '=' | ',' | ';' | '(' | ')' | '\'' | '"')
}

fn find_token_end(chars: &[char], start: usize) -> usize {
    let mut i = start;
    while i < chars.len() && !is_separator(chars[i]) {
        i += 1;
    }
    i
}

/// Check if a token should be replaced with `?`
fn should_replace_token(token: &str) -> bool {
    if token.is_empty() {
        return false;
    }

    // Pure numeric (3+ digits)
    if token.len() >= 3 && token.chars().all(|c| c.is_ascii_digit()) {
        return true;
    }

    // Short numeric (any digit-only token used as a value, e.g. id = 42)
    if token.len() >= 1 && token.chars().all(|c| c.is_ascii_digit()) {
        // Only replace if 2+ digits to avoid replacing single-digit constants
        if token.len() >= 2 {
            return true;
        }
    }

    // Prefixed IDs: word_digits or word_hex pattern (e.g., txn_1774095094, pay_abc123)
    if token.contains('_') {
        let parts: Vec<&str> = token.splitn(2, '_').collect();
        if parts.len() == 2 && !parts[1].is_empty() {
            let suffix = parts[1];
            // Suffix has digits mixed in → likely an ID
            let has_digit = suffix.chars().any(|c| c.is_ascii_digit());
            let all_alnum = suffix.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
            if has_digit && all_alnum && suffix.len() >= 3 {
                return true;
            }
        }
    }

    // Pure hex string (8+ chars, all hex digits, has both letters and digits)
    if token.len() >= 8
        && token.chars().all(|c| c.is_ascii_hexdigit())
        && token.chars().any(|c| c.is_ascii_digit())
        && token.chars().any(|c| c.is_ascii_alphabetic())
    {
        return true;
    }

    false
}

/// Check if there's a UUID at position `start` in the char slice
fn is_uuid_at(chars: &[char], start: usize) -> bool {
    // Pattern: 8-4-4-4-12 hex chars with dashes
    let expected_len = 36;
    if start + expected_len > chars.len() {
        return false;
    }

    let dash_positions = [8, 13, 18, 23];
    for (offset, ch) in chars[start..start + expected_len].iter().enumerate() {
        if dash_positions.contains(&offset) {
            if *ch != '-' {
                return false;
            }
        } else if !ch.is_ascii_hexdigit() {
            return false;
        }
    }
    true
}

/// Services that are part of the monitoring infrastructure itself.
/// Logs and traces from these services are filtered out at ingress.
const INTERNAL_SERVICES: &[&str] = &["master-service", "node-agent"];

/// Check if a service name belongs to internal monitoring infrastructure.
pub fn is_internal_service(service: &str) -> bool {
    INTERNAL_SERVICES.contains(&service)
}

/// Check if a span's HTTP status code indicates an error (4xx or 5xx).
/// Reads from the `http.status_code` key in the span's meta attributes.
pub fn is_http_error(meta: &std::collections::HashMap<String, String>) -> bool {
    meta.get("http.status_code")
        .and_then(|s| s.parse::<u16>().ok())
        .map(|code| code >= 400)
        .unwrap_or(false)
}

/// Determine if a span should be considered an error.
/// Returns true if the agent set error > 0 OR the HTTP status is 4xx/5xx.
pub fn is_error_span(error_flag: i32, meta: &std::collections::HashMap<String, String>) -> bool {
    error_flag > 0 || is_http_error(meta)
}

/// Extract the HTTP status code from span meta, defaulting to 0.
pub fn extract_status_code(meta: &std::collections::HashMap<String, String>) -> u16 {
    meta.get("http.status_code")
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_txn_id() {
        assert_eq!(
            sanitize_resource("cache.GET txn:txn_1774095094"),
            "cache.GET txn:?"
        );
    }

    #[test]
    fn test_sanitize_path_numeric() {
        assert_eq!(
            sanitize_resource("/api/users/12345/orders"),
            "/api/users/?/orders"
        );
    }

    #[test]
    fn test_sanitize_sql_id() {
        assert_eq!(
            sanitize_resource("SELECT * FROM users WHERE id = 42"),
            "SELECT * FROM users WHERE id = ?"
        );
    }

    #[test]
    fn test_sanitize_uuid() {
        assert_eq!(
            sanitize_resource("GET /items/550e8400-e29b-41d4-a716-446655440000/detail"),
            "GET /items/?/detail"
        );
    }

    #[test]
    fn test_sanitize_prefixed_id() {
        assert_eq!(
            sanitize_resource("payment:pay_abc123def456"),
            "payment:?"
        );
    }

    #[test]
    fn test_preserve_simple_resource() {
        assert_eq!(
            sanitize_resource("HTTP GET /health"),
            "HTTP GET /health"
        );
    }

    #[test]
    fn test_preserve_operation_prefix() {
        assert_eq!(
            sanitize_resource("cache.GET"),
            "cache.GET"
        );
    }

    #[test]
    fn test_internal_service_detected() {
        assert!(is_internal_service("master-service"));
        assert!(is_internal_service("node-agent"));
    }

    #[test]
    fn test_app_service_not_internal() {
        assert!(!is_internal_service("auth-service"));
        assert!(!is_internal_service("payment-service"));
        assert!(!is_internal_service("order-service"));
    }
}
