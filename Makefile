.PHONY: build dev install package docs release-notes-init release-notes-preview release

VERSION_IN_MANIFEST := $(shell node -p "require('./public/manifest.json').version")

# Type-check and build the extension into dist/.
build:
	npm run build

# Rebuild the settings panel on every save.
dev:
	npm run dev

# Bump the patch version, build, and copy dist/ to the folder Chrome loads
# (EARSUP_INSTALL_DIR, or Windows Downloads/EarsUp on WSL).
install:
	npm run release

# Zip dist/ into release/earsup-vX.Y.Z.zip.
package: build
	python3 scripts/package.py

# Serve the docs at http://127.0.0.1:8000
docs:
	mkdocs serve

# Create docs/releases/$(VERSION).md from the template.
# Usage: make release-notes-init VERSION=v1.2.3
release-notes-init:
	@if [ -z "$(VERSION)" ]; then echo "usage: make release-notes-init VERSION=v1.x.x"; exit 1; fi
	@if [ -f "docs/releases/$(VERSION).md" ]; then echo "docs/releases/$(VERSION).md already exists"; exit 1; fi
	@DATE=$$(date -u +%Y-%m-%d); \
	sed \
		-e "s/__VERSION__/$(VERSION)/g" \
		-e "s/__DATE__/$$DATE/g" \
		docs/releases/_template.md > docs/releases/$(VERSION).md
	@echo "created docs/releases/$(VERSION).md. Fill it in and run 'make release VERSION=$(VERSION)'"

# Print the notes as they will appear on GitHub.
release-notes-preview:
	@if [ -z "$(VERSION)" ]; then echo "usage: make release-notes-preview VERSION=v1.x.x"; exit 1; fi
	python3 scripts/release_gh.py $(VERSION) --render

# Build, zip, tag, push, and publish a GitHub release with the zip attached.
# The manifest version must already match. Usage: make release VERSION=v1.2.3
release:
	@if [ -z "$(VERSION)" ]; then echo "usage: make release VERSION=v1.x.x"; exit 1; fi
	@if [ "v$(VERSION_IN_MANIFEST)" != "$(VERSION)" ]; then echo "manifest says v$(VERSION_IN_MANIFEST), not $(VERSION)"; exit 1; fi
	@if [ -n "$$(git status --porcelain)" ]; then echo "commit your changes first"; exit 1; fi
	$(MAKE) package
	git tag -a $(VERSION) -m "EarsUp $(VERSION)"
	git push origin main $(VERSION)
	python3 scripts/release_gh.py $(VERSION)
