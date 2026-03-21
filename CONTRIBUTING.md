# Contributing to agent-comply

Thanks for your interest in contributing. agent-comply is part of the [Preflight](https://github.com/StanislavBG/agent-gate) suite of AI agent pre-deploy CLIs.

## Dev setup

```bash
git clone https://github.com/StanislavBG/agent-comply.git
cd agent-comply
npm install
npm test
```

Requires Node.js 18+.

## Project structure

```
src/
  cli.ts                  Entry point — CLI arg parsing (commander)
  classifier.ts           EU AI Act risk tier classification logic
  scanner.ts              Top-level scanner orchestration
  reporter.ts             Default terminal report formatter

  commands/               One file per CLI command
    init.ts               agent-comply init
    scan.ts               agent-comply scan
    classify.ts           agent-comply classify
    check.ts              agent-comply check
    report.ts             agent-comply report

  checker/                Policy rule evaluation engine
    index.ts              Rule runner — loads policy.yaml, evaluates rules

  parser/                 File parsing utilities
    index.ts              Detects AI provider imports across languages

  reporter/               Structured output formatters
    sarif.ts              SARIF 2.1.0 output
    junit.ts              JUnit XML output

  rules/                  Built-in policy rule definitions
    index.ts              Rule registry

  scanner/                Low-level file scanning
    index.ts              Walks directory tree, matches provider patterns

  types/                  Shared TypeScript interfaces
    index.ts              ComplyConfig, PolicyFile, Rule, Finding, RiskTier

schemas/                  JSON schemas for comply.yaml + policy.yaml validation
examples/                 Example comply.yaml and policy.yaml files
tests/                    Vitest test suite
```

## Running tests

```bash
npm test
```

Tests use [Vitest](https://vitest.dev/). Test files live in `tests/` or alongside source files as `*.test.ts`.

To run a specific test file:

```bash
npx vitest run tests/checker/checker.test.ts
```

To watch during development:

```bash
npx vitest
```

## Building

```bash
npm run build
```

Compiles TypeScript via `tsc`. Output goes to `dist/`. The compiled CLI entry point is `dist/cli.js`.

To test the built CLI locally:

```bash
npm run build
node dist/cli.js check policy.yaml

# Or run without building first
npm run dev -- classify ./src
```

## comply.yaml format

`comply.yaml` is the AI model inventory for a project. Created by `agent-comply init`, edited by hand.

```yaml
project:
  name: my-ai-app
  version: "1.0.0"
  owner: engineering@example.com

models:
  - id: gpt4-assistant           # unique identifier within this project
    provider: openai             # openai | anthropic | google | mistral | cohere | ...
    model: gpt-4                 # model name as reported by the provider
    use_case: "customer support chatbot"
    risk_tier: limited           # minimal | limited | high | unacceptable
    human_oversight: true        # is a human in the loop?
    data_categories:             # types of data this model processes
      - user_messages
    transparency_notice: true    # is a transparency notice shown to end users?
    notes: "Deployed via Azure OpenAI"
```

Fields under `project` and `models[]` are what `check` validates against. Unknown fields are passed through without error.

## policy.yaml format

`policy.yaml` defines rules that `agent-comply check` enforces.

```yaml
name: EU AI Act Baseline Policy
version: "1.0.0"
description: "Minimum compliance requirements for EU AI Act Article 52"

rules:
  - id: OWNER_REQUIRED            # unique rule ID, used in error output and SARIF
    description: "Project must have a declared owner"
    severity: error               # error (exit 1) | warning (exit 0)
    condition:
      field: project.owner        # dot-path into comply.yaml
      operator: required          # required | equals | not_equals | one_of | min_length

  - id: OVERSIGHT_ALL_MODELS
    description: "All models must have human_oversight declared"
    severity: warning
    condition:
      field: models[].human_oversight   # [] applies the rule to every array item
      operator: required

  - id: NO_UNACCEPTABLE_RISK
    description: "No model may be classified as unacceptable risk"
    severity: error
    condition:
      field: models[].risk_tier
      operator: not_equals
      value: unacceptable
```

Supported operators: `required`, `equals`, `not_equals`, `one_of`, `min_length`.

## EU AI Act risk tiers

agent-comply classifies AI models into four tiers defined by the EU AI Act:

| Tier | Description | Examples |
|------|-------------|---------|
| **minimal** | No specific obligations. Most AI tools fall here. | Spam filters, basic recommenders, AI in video games |
| **limited** | Transparency obligations — users must know they are interacting with AI. | Chatbots, deepfake generators, emotion recognition tools |
| **high** | Strict requirements: conformity assessment, human oversight, logging, accuracy. | CV screening, credit scoring, medical diagnostics, critical infrastructure |
| **unacceptable** | Prohibited. Cannot be deployed in the EU. | Social scoring by governments, real-time remote biometric surveillance in public spaces, subliminal manipulation |

The `classify` command infers a risk tier from provider name, model name, and declared `use_case`. The result is a suggestion — the `risk_tier` field in `comply.yaml` is the authoritative value and should be confirmed with legal context.

Annex III of the EU AI Act enumerates the specific high-risk use cases. When `classify` flags a model as `high`, it outputs a note pointing to the relevant Annex III category.

## Adding a new policy rule operator

1. Add the operator to the operator union type in `src/types/index.ts`
2. Implement evaluation in `src/checker/index.ts`
3. Add a test case in `tests/checker/`
4. Document the operator in the README and in this file

## Adding a new compliance standard

Currently agent-comply targets the EU AI Act (Annex III). To add another standard (e.g. NIST AI RMF):

1. Create `src/rules/standards/<standard>.ts` with rule definitions
2. Register it in `src/commands/check.ts` standard lookup
3. Add an example policy YAML to `examples/`
4. Add to the `--standard` flag description in `src/cli.ts`

## Pull request guidelines

- All changes must have passing tests (`npm test`).
- New commands or rule operators require at least one test covering the happy path and one covering the failure path.
- TypeScript strict mode. No `any` without a comment explaining why.
- Keep CLI output human-readable by default. Machine-readable output belongs behind `--format sarif` or `--format junit`.
- PRs that change the `comply.yaml` or `policy.yaml` schema must update the examples in `/examples`.
- CLI errors: `console.error()` + `process.exit(1)` for policy violations, `process.exit(2)` for usage errors.
- Offline-first: no network calls in the core classifier or rule engine.

Submitting:

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes with tests
4. Run `npm test` and `npm run build`
5. Open a PR against `main`

## Reporting issues

Open an issue at https://github.com/StanislavBG/agent-comply/issues.

Include:
- agent-comply version (`agent-comply --version`)
- Node.js version (`node --version`)
- The command you ran
- Actual vs expected output
- Sanitized `comply.yaml` and `policy.yaml` if relevant (remove any internal project details)

## License

MIT. Contributions are accepted under the same license.
