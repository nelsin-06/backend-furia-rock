# ---------------------------------------------------------------------------
# SAM Build – lightweight Lambda artifact
#
# Called by `sam build` when the Function declares BuildMethod: makefile.
# SAM sets ARTIFACTS_DIR to the temp directory where the artifact must land.
#
# What goes into the artifact:
#   dist/          – compiled JS + asset copies (e.g. .hbs templates)
#   node_modules/  – production dependencies only (no devDependencies)
#   package.json   – needed by some deps for self-resolution
#
# What is excluded:
#   src/, test/, *.md, .env*, docker-compose.yml, coverage/, etc.
# ---------------------------------------------------------------------------

.PHONY: build-FuriaApiFunction build-ExpirePendingOrdersFunction

build-FuriaApiFunction:
	@echo "==> [1/3] Installing ALL deps (need devDeps for nest build)..."
	npm ci
	@echo "==> [2/3] Compiling NestJS (nest build -> dist/)..."
	npx nest build
	@echo "==> [3/3] Assembling lightweight artifact in $(ARTIFACTS_DIR)..."
	cp -r dist "$(ARTIFACTS_DIR)/dist"
	cp package.json "$(ARTIFACTS_DIR)/package.json"
	cp package-lock.json "$(ARTIFACTS_DIR)/package-lock.json"
	cd "$(ARTIFACTS_DIR)" && npm ci --omit=dev
	@echo "==> Done. Artifact contents:"
	@du -sh "$(ARTIFACTS_DIR)/dist" "$(ARTIFACTS_DIR)/node_modules" 2>/dev/null || true

build-ExpirePendingOrdersFunction:
	@echo "==> [1/3] Installing ALL deps (need devDeps for nest build)..."
	npm ci
	@echo "==> [2/3] Compiling NestJS (nest build -> dist/)..."
	npx nest build
	@echo "==> [3/3] Assembling lightweight artifact in $(ARTIFACTS_DIR)..."
	cp -r dist "$(ARTIFACTS_DIR)/dist"
	cp package.json "$(ARTIFACTS_DIR)/package.json"
	cp package-lock.json "$(ARTIFACTS_DIR)/package-lock.json"
	cd "$(ARTIFACTS_DIR)" && npm ci --omit=dev
	@echo "==> Done. Artifact contents:"
	@du -sh "$(ARTIFACTS_DIR)/dist" "$(ARTIFACTS_DIR)/node_modules" 2>/dev/null || true
