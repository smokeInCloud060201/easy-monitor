---
wave: 1
depends_on: []
files_modified: ["mock-app/docker-compose.yml", "mock-app/start.sh", "mock-app/category-service", "mock-app/checkout-service"]
autonomous: true
---

# Plan: Rename Legacy Mock Services

<objective>
Rename the `category-service` to `product-service` and `checkout-service` to `order-service` across the mock-app structure.
</objective>

<tasks>
<task>
<description>Update the physical filesystem and Docker mappings</description>
<read_first>
- mock-app/docker-compose.yml
- mock-app/start.sh
</read_first>
<action>
1. `mv mock-app/category-service mock-app/product-service`
2. `mv mock-app/checkout-service mock-app/order-service`
3. Update `docker-compose.yml` changing `category-service` build contexts and container names to `product-service` handling ports (e.g. 8081).
4. Update `docker-compose.yml` changing `checkout-service` to `order-service` (Port 8080).
5. Update `start.sh` reflecting the new module directory names and runner hooks.
</action>
<acceptance_criteria>
- `mock-app/docker-compose.yml` contains `product-service` instead of `category-service`
- `mock-app/start.sh` executes `./product-service/...` perfectly.
</acceptance_criteria>
</task>
</tasks>
