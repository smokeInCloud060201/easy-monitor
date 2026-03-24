.PHONY: help master-service agent-node mock-app setup dashboard dev

# Colors
GREEN  := \033[0;32m
YELLOW := \033[1;33m
CYAN   := \033[0;36m
RESET  := \033[0m

## help: Show available commands
help:
	@echo ""
	@echo "$(CYAN)Easy Monitor$(RESET) — Development Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  $(GREEN)make setup$(RESET)           Run docker compose (ClickHouse, etc.)"
	@echo "  $(GREEN)make master-service$(RESET)   Run master service"
	@echo "  $(GREEN)make agent-node$(RESET)       Run agent node"
	@echo "  $(GREEN)make mock-app$(RESET)         Run mock app"
	@echo "  $(GREEN)make mock-down$(RESET)        Kill all mock app services"
	@echo "  $(GREEN)make dashboard$(RESET)        Run dashboard (Vite dev server)"
	@echo "  $(GREEN)make dev$(RESET)              Run all services (master, agent, mock-app, dashboard)"
	@echo ""

## setup: Run docker compose
setup:
	docker compose up -d

## master-service: Run master service
master-service:
	cargo run -p master-service

## agent-node: Run agent node
agent-node:
	cargo run -p node-agent

## mock-app: Run mock app
mock-app:
	cd mock-app && ./start.sh

## mock-down: Kill all mock app services
mock-down:
	-pkill -f 'java|category-service|bun|notification-service|start.sh'
	-lsof -ti:8080,8081,8082,8083,8085,8086,8087,8088,8089 | xargs kill -9 2>/dev/null

## dashboard: Run dashboard (Vite dev server)
dashboard:
	cd dashboard && npm run dev

## dev: Run master-service, agent-node, mock-app, and dashboard concurrently
dev:
	@echo "Starting all services..."
	@$(MAKE) master-service & \
	 $(MAKE) agent-node & \
	 $(MAKE) mock-app & \
	 $(MAKE) dashboard & \
	 wait
