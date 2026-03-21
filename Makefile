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
	cd mock-app && node index.js

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
