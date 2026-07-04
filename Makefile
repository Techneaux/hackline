# Hack Line — dev commands + Docker container management.
# Run `make` (or `make help`) to list targets.

PORT    ?= 3000

# Load the Node version pinned in .nvmrc via nvm when available; otherwise fall
# back to whatever `node` is on PATH. (The app needs Node 24 — see .nvmrc.)
NVM := export NVM_DIR="$${NVM_DIR:-$$HOME/.nvm}"; [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh" && nvm use >/dev/null 2>&1;

.DEFAULT_GOAL := help
.PHONY: help deps dev build start-fg test typecheck \
        docker-up docker-down docker-logs docker-rebuild

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

## --- Docker (Rancher Desktop) --------------------------------------------

docker-up: ## Build (if needed) + start the container (port from .env HACKLINE_PORT)
	@docker compose up -d --build
	@port=$$(grep -sE '^HACKLINE_PORT=' .env | tail -1 | cut -d= -f2); echo "Running — http://localhost:$${port:-3000}"

docker-down: ## Stop and remove the container
	@docker compose down

docker-rebuild: ## Rebuild the image from scratch and restart
	@docker compose build --no-cache && docker compose up -d

docker-logs: ## Tail the container logs
	@docker compose logs -f
