# Node 22 Alignment — Status

**Scope:** GitHub Actions workflows and the separate Node server/tooling only.

**Not in scope / clarification:** Supabase Edge Functions run on **Deno**, not Node. They were never on Node 20 and have not been "migrated" to Node 22. Any earlier phrasing suggesting Edge Functions moved from Node 20 → 22 was inaccurate.

## Changes

- `.github/workflows/security.yml` — `npm-audit` job `actions/setup-node` bumped from `"20"` to `"22"`. All other workflows (`accessibility.yml`, `regression.yml`) were already on Node 22. `codeql.yml`, `robots.yml`, `zap.yml` do not pin a Node version via `setup-node`.
- `package.json` — added `engines.node: ">=22 <23"`.
- `server/package.json` — added `engines.node: ">=22 <23"`.
- `.devcontainer/devcontainer.json` — uses `mcr.microsoft.com/devcontainers/universal:2`, which already ships Node ≥ 20 with Node 22 available; no downgrade present, left as-is.

No dependency versions, application behavior, Supabase state, secrets, or deploys were touched.
