# draw-steel-negotiation-test-tool — Copilot Instructions

Foundry VTT V13 module for Draw Steel negotiation encounters. See module-design-doc.md and ARCHITECTURE.local.md for design details.

## Stack
- TypeScript source in `src/`, compiled to `scripts/`
- Module manifest: `module.json`
- Templates: `templates/` (Handlebars)
- Styles: `styles/`
- Localization: `lang/en.json`
- Tests: `test/`
- Build: `npm run build`

## Conventions
- Follow Foundry VTT V13 API patterns
- Use the MCP server's `generate_negotiation_test` tool to create test negotiation data
- Use `lookup_rule` or `get_rules_for_topic` to verify negotiation mechanics
- Reference `reference/` for Draw Steel negotiation rules
