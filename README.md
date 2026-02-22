# draw-steel-negotiation-test-tool

Foundry VTT v13 module that adds a Draw Steel Negotiation Test item.

## Build a Foundry zip

Creates a zip in `dist/` containing a top-level module folder (matching `module.json` -> `id`).

- `npm run build`
- `npm run build:clean`

## Publish via GitHub Releases (gh CLI)

Prereqs:
- Install GitHub CLI: `gh`
- Authenticate locally: `gh auth login`

Then:
- `npm run build`
- `npm run release:draft` (creates `v<module.json version>` and uploads the zip)

You can pass a custom tag:
- `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -Tag v0.1.0 -Draft`