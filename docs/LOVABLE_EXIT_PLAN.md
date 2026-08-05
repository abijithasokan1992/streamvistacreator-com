# StreamVista Lovable Exit Plan

## Decision

GitHub is the canonical source of truth. Lovable editor credits are not required for development, builds, MCP generation, or deployment.

## Reused architecture

- React + TypeScript + Vite frontend
- Existing component library and design tokens
- Existing Supabase database, RLS, Edge Functions, migrations, and storage
- Existing `src/lib/mcp` tool source
- Existing generated `supabase/functions/mcp` deployment target

## GitHub-native workflow

1. Changes are made through Git branches and pull requests.
2. GitHub Actions installs dependencies with Node 22.
3. `npm test` and `npm run build` validate the application.
4. The Vite MCP generator produces the deployable `supabase/functions/mcp` bundle.
5. The generated bundle is uploaded as a GitHub Actions artifact.
6. Production deployment is performed directly through Supabase, without Lovable publishing or paid Lovable agent credits.

## Ownership boundaries

- `.lovable/mcp/manifest.json` is retained only as an MCP protocol artifact while the current generator package is used.
- Application logic, UI, schemas, migrations, and MCP source remain in GitHub.
- Generated deployment bundles are reproducible from GitHub source.
- No application feature may require Lovable editor access at runtime.

## Migration phases

### Phase 1 — build and deployment independence

- Replace obsolete Webpack CI with Node 22 Vite CI.
- Run tests and production build on every pull request.
- Publish generated MCP bundle as an artifact.
- Deploy Edge Functions directly to Supabase.

### Phase 2 — UI restructuring

- Inventory existing admin, creator, buyer, studio, and public surfaces.
- Consolidate duplicate navigation and orchestration components.
- Preserve existing design tokens and reusable components.
- Move each approved UI slice through build, tests, deployment, and live verification.

### Phase 3 — optional SDK replacement

- Replace `@lovable.dev/mcp-js` only after an equivalent OAuth-capable MCP runtime is implemented and verified.
- Do not remove the working SDK before parity tests pass.

## Completion rule

A migration slice is complete only after source changes, tests, build, deployment, and live verification have passed.
