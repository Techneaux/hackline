# Hack Line — dev + launchd service management.
# Run `make` (or `make help`) to list targets.

LABEL   := com.hackline.app
PLIST   := $(HOME)/Library/LaunchAgents/$(LABEL).plist
PORT    ?= 3000
LOG_DIR := data/logs

# Load the Node version pinned in .nvmrc via nvm when available; otherwise fall
# back to whatever `node` is on PATH. (The app needs Node 24 — see .nvmrc.)
NVM := export NVM_DIR="$${NVM_DIR:-$$HOME/.nvm}"; [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && nvm use >/dev/null 2>&1;

.DEFAULT_GOAL := help
.PHONY: help deps dev build start-fg test typecheck \
        install-service autostart start stop restart status logs uninstall-service

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

## --- Development ---------------------------------------------------------

deps: ## Install npm dependencies
	@$(NVM) npm install

dev: ## Run the dev server in the foreground (http://localhost:3000)
	@$(NVM) npm run dev

build: ## Production build
	@$(NVM) npm run build

start-fg: build ## Build, then run the production server in the foreground
	@$(NVM) npm run start -- -p $(PORT)

test: ## Run the test suite (vitest)
	@$(NVM) npm test

typecheck: ## Type-check without emitting
	@$(NVM) npx tsc --noEmit

## --- launchd background service (starts at login, auto-restarts) ---------

install-service: ## Build + install/reload the launchd agent on :3000
	@$(NVM) bash scripts/install-launchd.sh

autostart: install-service ## Alias for install-service

start: ## Start the background service (load the launchd agent)
	@test -f "$(PLIST)" || { echo "No service installed — run 'make install-service' first."; exit 1; }
	@launchctl load "$(PLIST)" && echo "Started — http://localhost:$(PORT)"

stop: ## Stop the background service (unload the launchd agent)
	@launchctl unload "$(PLIST)" 2>/dev/null && echo "Stopped." || echo "Not running."

restart: stop start ## Restart the background service

status: ## Show whether the service is running
	@launchctl list | grep -q "$(LABEL)" \
		&& echo "running (PID $$(launchctl list | awk '/$(LABEL)/{print $$1}'))" \
		|| echo "not running"
	@curl -fsS -o /dev/null -w "http :$(PORT) -> %{http_code}\n" http://localhost:$(PORT) 2>/dev/null || true

logs: ## Tail the service's error log
	@tail -f "$(LOG_DIR)/hackline.err.log"

uninstall-service: ## Stop the service and remove its launchd plist
	@launchctl unload "$(PLIST)" 2>/dev/null || true
	@rm -f "$(PLIST)" && echo "Removed $(PLIST)"
