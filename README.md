# agent-comply

**EU AI Act compliance CLI — classify, check, and report AI system compliance.**

---

You're shipping an AI agent. Someone on legal asks "are we compliant with the EU AI Act?" You check the doc again, realize you have no record of what models you're using or their risk tier, and spend three days filling in a spreadsheet.

agent-comply turns that into a 90-second CLI run.

```bash
npm install -g agent-comply
```

---

## 30-second quickstart

```bash
# 1. Scaffold a comply.yaml for your project
agent-comply init

# 2. Scan your codebase to detect AI model usage
agent-comply classify .

# 3. Check against a compliance policy
agent-comply check policy.yaml

# 4. Generate a report
agent-comply report
```

---

## Commands

### `agent-comply init`

Scaffold a `comply.yaml` in the current directory. Auto-detects AI providers in your codebase.

```bash
agent-comply init
agent-comply init --output ./compliance/comply.yaml
```

Output (`comply.yaml`):

```yaml
project:
  name: my-ai-app
  version: "1.0.0"
  owner: engineering@example.com

models:
  - id: gpt4-assistant
    provider: openai
    use_case: "customer support chatbot"
    risk_tier: limited
    human_oversight: true
    data_categories:
      - user_messages
```

### `agent-comply scan <path>`

Raw scan — detect which AI providers are imported in a codebase. No risk classification.

```bash
agent-comply scan ./src
```

Output:

```
── AI PROVIDER SCAN RESULTS ─────────────────────────────────
FILE                             PROVIDER        LINE
────────────────────────────────────────────────────────────
src/assistant.ts                 openai          12
src/pipeline.ts                  anthropic       5
```

Use `classify` instead if you want EU AI Act risk tiers.

### `agent-comply classify <path>`

Scan and classify AI usage against EU AI Act risk tiers (Annex III). Adds risk tier, human oversight flag, and compliance notes.

```bash
agent-comply classify ./src
```

Output:

```
── EU AI ACT RISK CLASSIFICATION ────────────────────────────
FILE              PROVIDER    MODEL               RISK TIER   NOTES
─────────────────────────────────────────────────────────────────
src/chatbot.ts    anthropic   claude-sonnet-4-6   limited     Requires transparency notice
src/filter.ts     openai      gpt-4               high        Biometric adjacent — check Annex III
```

Risk tiers: `minimal` · `limited` · `high` · `unacceptable`

### `agent-comply check <policy>`

Validate your `comply.yaml` against a policy file. Exits 1 on errors.

```bash
agent-comply check policy.yaml
agent-comply check policy.yaml --config ./compliance/comply.yaml
```

Requires two files:
- `comply.yaml` (the `--config` option, defaults to `./comply.yaml`) — your AI model inventory
- `<policy>` (positional arg) — the rules to enforce

A policy file looks like:

```yaml
name: EU AI Act Baseline Policy
version: "1.0.0"

rules:
  - id: OVERSIGHT_ALL_MODELS
    description: "All models must have human_oversight declared"
    severity: warning
    condition:
      field: models[].human_oversight
      operator: required

  - id: OWNER_REQUIRED
    description: "Project must have a declared owner"
    severity: error
    condition:
      field: project.owner
      operator: required
```

Output:

```
Checking: ./comply.yaml
Policy:   EU AI Act Baseline Policy v1.0.0
Rules:    3

ERRORS (1):
  ✗ [OWNER_REQUIRED] Project must have a declared owner (accountability)
    project.owner is missing

Result: 1 error(s), 0 warning(s)
```

### `agent-comply report`

Generate a compliance summary report from `comply.yaml`. Optionally include policy violation checks.

```bash
agent-comply report
agent-comply report --policy policy.yaml
agent-comply report --config ./compliance/comply.yaml --policy policy.yaml
```

---

## CI integration

```yaml
# .github/workflows/compliance.yml
name: EU AI Act Compliance

on: [push, pull_request]

jobs:
  comply:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g agent-comply
      - run: agent-comply check policy.yaml
```

Exit code 1 on policy violations. PR blocked.

---

## Workflow: dev to CI

```bash
# During development — fill out your comply.yaml
agent-comply init
agent-comply classify .   # auto-detect models

# Commit comply.yaml to your repo
git add comply.yaml policy.yaml
git commit -m "Add compliance config"

# In CI — enforce policy
agent-comply check policy.yaml
```

---

## Examples

See [`/examples`](./examples):
- [`comply.yaml`](./examples/comply.yaml) — complete model inventory with risk tiers
- [`policy.yaml`](./examples/policy.yaml) — EU AI Act baseline policy rules

---

## How this relates to the Preflight suite

| Tool | When to use it |
|------|---------------|
| **stepproof** | Before deploy: regression test your agent's behavior |
| **agent-comply** | Before deploy: verify EU AI Act compliance policy |
| **agent-gate** | In CI: unified pass/fail gate wrapping both tools |
| **agent-shift** | After gate passes: promote config safely to production |

Use `agent-comply` directly during development. Use `agent-gate` in CI as the final unified gate.

---

## Roadmap

- **v0.1** (now): Scan, classify, check, report — YAML-driven, offline, exit code 1 on violations
- **v0.2**: GDPR Article 13/14 transparency notice generation, annex III lookup table
- **Cloud dashboard** (month 3–6): Compliance history, trend charts, PDF export for auditors

---

## License

MIT

---

*agent-comply — because "we checked manually" doesn't hold up in an audit.*
