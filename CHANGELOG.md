# Changelog

All notable changes to agent-comply are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning: [Semantic Versioning](https://semver.org/).

---

## [0.2.1] — 2026-03-19

### Fixed
- Exit codes normalized: `agent-comply` with no args exits 0. Unknown commands exit 2.
- `@bilkobibitkov/preflight-license` dependency corrected (was `@preflight/license` — npm registry conflict).

### Changed
- `--help` output improved with concrete examples on root command.

### Added
- Command-level error handling tests and scanner edge case coverage.
- CONTRIBUTING.md with full dev setup guide.

---

## [0.2.0] — 2026-02-28

### Added
- `agent-comply init` command — scaffolds starter compliance scenario file.
- `--output <file>` flag — exports compliance scan results in SARIF or JUnit XML.
- `--help` examples on all subcommands.
- LICENSE file (MIT).

### Changed
- Scanner false negative on nonexistent paths: now returns explicit error with path.
- Error output routes to stderr; scan results to stdout (CI-friendly).

---

## [0.1.0] — 2026-01-15

### Added
- Initial release.
- EU AI Act compliance scanning for AI agent outputs.
- Pre-built assertion sets for GDPR Article 22, EU AI Act Article 9/13/14.
- `scan` command with terminal reporter and CI exit codes.
- `report` command for audit trail generation.
- YAML-based policy configuration.
- Preflight License integration for Team/Enterprise policy sets.

---

## Links
- npm: `npm install agent-comply`
- GitHub: [StanislavBG/agent-comply](https://github.com/StanislavBG/agent-comply)
- Suite: [Preflight](https://github.com/StanislavBG/agent-gate) — stepproof + agent-comply + agent-gate
