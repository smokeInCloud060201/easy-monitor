# TESTING

## Frameworks & Structure
- **Backend (Rust)**:
  - Strongly relies on Rust's built-in testing harness (`cargo test`).
  - Unit tests are typically organized within the modules they test (e.g., `#[cfg(test)] mod tests { ... }`).
  - Integration tests would conventionally reside in a `tests/` directory at the crate level if present.

- **Frontend (React)**:
  - Testing structure is not heavily parameterized in the default `package.json` aside from linting, but standard Vite/React applications use Vitest or Jest.

## Mocking & Coverage
- Backend mocking is often achieved through traits or libraries like `mockall` if integrated.
- Frontend may use `msw` for network mocking or standard React Testing Library patterns.

## CI/CD
- Specific CI pipeline configurations (like GitHub Actions `.github/workflows`) are standard for running `cargo test`, `cargo clippy`, and `npm run lint`.
