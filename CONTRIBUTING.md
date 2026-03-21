# Contributing to agent-comply

Thanks for your interest in contributing. agent-comply is part of the [Preflight](https://github.com/StanislavBG/agent-gate) suite of AI agent pre-deploy CLIs.

## Dev setup

```bash
git clone https://github.com/StanislavBG/agent-comply
cd agent-comply
npm install
```

## Running tests

```bash
npm test
```

All tests use [vitest](https://vitest.dev/). Tests live in `./tests/`.

## Building

```bash
npm run build
```

TypeScript is compiled to `./dist/`. The CLI entry point is `dist/cli.js`.

## Running locally

```bash
# Run against your project without building
npm run dev -- classify ./src

# Or after build
node dist/cli.js classify ./src
node dist/cli.js check ./examples/policy.yaml
```

## Project structure

```
src/
  cli.ts              — CLI entry point (Commander.js commands)
  commands/           — Command implementations (init, scan, classify, check, report)
  classifier.ts       — EU AI Act risk tier classification logic
  scanner.ts          — AI provider detection in codebases
  reporter.ts         — Output formatting
  rules/              — Policy rule evaluation
  parser/             — YAML config and policy parsing
  types/              — Shared TypeScript types
schemas/              — JSON schemas for comply.yaml + policy.yaml validation
examples/             — Example comply.yaml and policy.yaml files
tests/                — Vitest test suite
```

## Adding a new policy rule operator

1. Add the operator to the operator union type in `src/types/index.ts`
2. Implement evaluation in `src/rules/evaluator.ts`
3. Add a test case in `tests/rules/evaluator.test.ts`
4. Document the operator in the README

## Adding a new compliance standard

Currently agent-comply targets EU AI Act (Annex III). To add another standard (e.g. NIST AI RMF):

1. Create `src/rules/standards/<standard>.ts` with rule definitions
2. Register it in `src/commands/check.ts` standard lookup
3. Add example policy YAML to `examples/`
4. Add to the `--standard` flag description in `src/cli.ts`

## Submitting changes

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `npm test`
5. Build: `npm run build`
6. Open a PR against `main`

## Code style

- TypeScript strict mode
- Named exports throughout
- CLI errors: `console.error()` + `process.exit(1)` for policy violations, `process.exit(2)` for usage errors
- Offline-first: no network calls in the core classifier or rule engine

## Reporting bugs

Open an issue on GitHub with:
- The command you ran
- Your `comply.yaml` (redact any sensitive fields)
- The agent-comply version (`agent-comply --version`)
- The error output
- Your Node.js version (`node --version`)

## License

MIT. Contributions are accepted under the same license.
