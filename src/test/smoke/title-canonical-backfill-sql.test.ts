import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SQL_PATH = resolve(
  __dirname,
  "../../../supabase/migrations-pending/20260717_000000_title_canonical_backfill.sql",
);
const sql = readFileSync(SQL_PATH, "utf8");
const lower = sql.toLowerCase();
// SQL with `--` line comments stripped, used for tests that inspect executable
// statements only (comments contain illustrative snippets that intentionally
// don't satisfy the runtime guards).
const sqlNoComments = sql
  .split(/\r?\n/)
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n");

/**
 * Static text-safety checks for the pending title canonical backfill. The
 * migration is NEVER executed in tests — we only assert that its source text
 * enforces the hardening rules agreed during review.
 */
describe("title_canonical_backfill.sql — hardening", () => {
  it("still lives in migrations-pending (never auto-run)", () => {
    expect(SQL_PATH).toMatch(/migrations-pending/);
  });

  it("wraps the whole body in a single BEGIN/COMMIT", () => {
    expect(lower.match(/\bbegin\b/g)?.length).toBe(1);
    expect(lower.match(/\bcommit\b/g)?.length).toBe(1);
  });

  it("performs no DELETE, MERGE, TRUNCATE or DROP TABLE against content_titles", () => {
    expect(/delete\s+from\s+public\.content_titles/i.test(sql)).toBe(false);
    expect(/\bmerge\s+into\b/i.test(sql)).toBe(false);
    expect(/\btruncate\b/i.test(sql)).toBe(false);
    expect(/drop\s+table\s+[^;]*content_titles/i.test(sql)).toBe(false);
  });

  it("preserves conflict evidence with UNIQUE(title_id, field) + ON CONFLICT DO NOTHING", () => {
    expect(/unique\s*\(\s*title_id\s*,\s*field\s*\)/i.test(sql)).toBe(true);
    const inserts = sql.match(/insert into public\.title_backfill_conflicts/gi) ?? [];
    const doNothings = sql.match(/on conflict\s*\(\s*title_id\s*,\s*field\s*\)\s*do nothing/gi) ?? [];
    expect(inserts.length).toBeGreaterThanOrEqual(4);
    expect(doNothings.length).toBeGreaterThanOrEqual(inserts.length);
  });

  it("keeps service_role access on the conflicts table", () => {
    expect(/grant\s+all\s+on\s+public\.title_backfill_conflicts\s+to\s+service_role/i.test(sql)).toBe(true);
  });

  describe("genres reads are type-guarded", () => {
    // Every occurrence of metadata->'genres'->>0 or jsonb_array_length(...->'genres')
    // must appear inside a CASE/AND expression that first checks
    // jsonb_typeof(metadata->'genres') = 'array'. We assert this at the
    // statement level: every SQL statement that references 'genres' also
    // references jsonb_typeof(...) = 'array' OR is a write-side guard that
    // includes the same check.
    const statements = sqlNoComments.split(/;\s*(?:\r?\n|$)/);
    const genreStatements = statements.filter((s) => /(?:\w+\.)?metadata->('|")?genres/i.test(s));

    it("has at least three statements that touch metadata.genres", () => {
      expect(genreStatements.length).toBeGreaterThanOrEqual(3);
    });

    it("guards every genres-touching statement with jsonb_typeof(...)='array'", () => {
      for (const stmt of genreStatements) {
        const touchesArrayLen = /jsonb_array_length\s*\(\s*(?:\w+\.)?metadata->('|")?genres/i.test(stmt);
        const touchesFirst = /(?:\w+\.)?metadata->('|")?genres('|")?\s*->>\s*0/i.test(stmt);
        if (!touchesArrayLen && !touchesFirst) continue;
        expect(
          /jsonb_typeof\s*\(\s*(?:\w+\.)?metadata->('|")?genres('|")?\s*\)\s*(=|is distinct from)\s*'array'/i.test(stmt),
          `statement is missing jsonb_typeof(...)='array' guard:\n${stmt}`,
        ).toBe(true);
      }
    });
  });

  describe("runtime_minutes parsing is bounded and CASE-based", () => {
    it("uses a bounded digit regex (1..5 digits), never an unbounded ^[0-9]+$", () => {
      expect(/\^\[0-9\]\{1,5\}\$/.test(sql)).toBe(true);
      expect(/\^\[0-9\]\+\$/.test(sql)).toBe(false);
    });

    it("enforces a 1..14400 minute bound on every parsed runtime", () => {
      // BETWEEN 1 AND 14400 must appear at least twice: conflict detection
      // and canonical backfill.
      const between = sql.match(/between\s+1\s+and\s+14400/gi) ?? [];
      expect(between.length).toBeGreaterThanOrEqual(2);
    });

    it("never casts metadata->>'runtime_minutes' to ::int outside a CASE", () => {
      // Any occurrence of (metadata->>'runtime_minutes')::int must be
      // textually preceded by a CASE / WHEN on the same value. We check by
      // splitting into statements and requiring CASE ... WHEN ... ~ ... THEN ... ::int.
      const statements = sqlNoComments.split(/;\s*(?:\r?\n|$)/);
      for (const stmt of statements) {
        const casts = stmt.match(/\(\s*metadata->>'runtime_minutes'\s*\)::int/gi) ?? [];
        if (casts.length === 0) continue;
        expect(
          /case\s+when\s*\(?\s*metadata->>'runtime_minutes'\s*\)?\s*~\s*'\^\[0-9\]\{1,5\}\$'\s+then\s*\(\s*metadata->>'runtime_minutes'\s*\)::int/i.test(stmt),
          `unsafe ::int cast on runtime_minutes outside a CASE guard:\n${stmt}`,
        ).toBe(true);
      }
    });
  });

  describe("RLS on title_backfill_conflicts", () => {
    it("enables RLS", () => {
      expect(/alter table public\.title_backfill_conflicts\s+enable row level security/i.test(sql)).toBe(true);
    });

    const privilegedRoles = ["admin", "super_admin", "platform_owner", "founder"] as const;

    it("SELECT policy names every privileged role", () => {
      const selectPolicy = sql.match(
        /create policy[^;]+for\s+select[^;]+title_backfill_conflicts[^;]+;/is,
      )
        ?? sql.match(/create policy[^;]+title_backfill_conflicts[\s\S]*?for\s+select[\s\S]*?;/i);
      // Fallback: find the SELECT policy block by role list.
      const selectBlock = sql.split(/create policy/i).find((b) => /for\s+select/i.test(b) && /title_backfill_conflicts/i.test(b) === false ? false : /for\s+select/i.test(b));
      const block = selectPolicy?.[0] ?? selectBlock ?? "";
      expect(block.length).toBeGreaterThan(0);
      for (const role of privilegedRoles) {
        expect(
          new RegExp(`has_role\\s*\\(\\s*auth\\.uid\\(\\)\\s*,\\s*'${role}'`, "i").test(block),
          `SELECT policy missing role '${role}'`,
        ).toBe(true);
      }
    });

    it("has an authenticated UPDATE policy with USING and WITH CHECK covering all privileged roles", () => {
      const updateBlocks = [...sql.matchAll(/create policy[\s\S]*?for\s+update[\s\S]*?with check\s*\([\s\S]*?\)\s*;/gi)]
        .map((m) => m[0])
        .filter((b) => /title_backfill_conflicts/i.test(b));
      expect(updateBlocks.length).toBeGreaterThanOrEqual(1);
      const block = updateBlocks[0];
      expect(/to\s+authenticated/i.test(block)).toBe(true);
      expect(/using\s*\(/i.test(block)).toBe(true);
      expect(/with check\s*\(/i.test(block)).toBe(true);
      for (const role of privilegedRoles) {
        // Must appear at least twice (once in USING, once in WITH CHECK).
        const hits = block.match(new RegExp(`has_role\\s*\\(\\s*auth\\.uid\\(\\)\\s*,\\s*'${role}'`, "gi")) ?? [];
        expect(hits.length, `UPDATE policy missing role '${role}' in USING/WITH CHECK`).toBeGreaterThanOrEqual(2);
      }
    });

    it("does NOT grant INSERT or DELETE to authenticated on the conflicts table", () => {
      const grants = sql.match(/grant[^;]+on\s+public\.title_backfill_conflicts\s+to\s+authenticated[^;]*;/gi) ?? [];
      expect(grants.length).toBeGreaterThan(0);
      for (const g of grants) {
        expect(/\binsert\b/i.test(g)).toBe(false);
        expect(/\bdelete\b/i.test(g)).toBe(false);
      }
      // And no policy grants INSERT/DELETE to authenticated either.
      const policies = [...sql.matchAll(/create policy[\s\S]*?;/gi)]
        .map((m) => m[0])
        .filter((b) => /title_backfill_conflicts/i.test(b));
      for (const p of policies) {
        if (/for\s+(insert|delete)/i.test(p)) {
          expect(/to\s+authenticated/i.test(p)).toBe(false);
        }
      }
    });
  });

  it("includes preflight count queries as comments only", () => {
    // Comment lines beginning with '-- SELECT count(*)' must exist, and no
    // executable (non-commented) SELECT count(*) statement should be present.
    const commentedCounts = sql
      .split(/\r?\n/)
      .filter((l) => /^\s*--(?:\s*--)?\s*SELECT\s+count\s*\(\s*\*\s*\)/i.test(l));
    expect(commentedCounts.length).toBeGreaterThanOrEqual(3);
    const uncommented = sql
      .split(/\r?\n/)
      .filter((l) => !/^\s*--/.test(l) && /\bselect\s+count\s*\(\s*\*\s*\)/i.test(l));
    expect(uncommented).toEqual([]);
  });

  describe("legacy import identity", () => {
    it("adds traceable source columns without making them required", () => {
      expect(/add column if not exists legacy_source_table text/i.test(sql)).toBe(true);
      expect(/add column if not exists legacy_source_id text/i.test(sql)).toBe(true);
      expect(/add column if not exists legacy_source_uuid text/i.test(sql)).toBe(true);
      expect(/legacy_source_(table|id|uuid)\s+text\s+not\s+null/i.test(sql)).toBe(false);
    });

    it("prevents a repeated legacy row or UUID from creating another title", () => {
      expect(
        /create unique index if not exists content_titles_legacy_source_idx[\s\S]*legacy_source_table\s*,\s*legacy_source_id/i.test(sql),
      ).toBe(true);
      expect(
        /create unique index if not exists content_titles_legacy_uuid_idx[\s\S]*legacy_source_uuid/i.test(sql),
      ).toBe(true);
    });

    it("uses explicit minimum Data API grants while RLS remains authoritative", () => {
      expect(
        /grant\s+select\s*,\s*insert\s*,\s*update\s+on\s+public\.content_titles\s+to\s+authenticated/i.test(sql),
      ).toBe(true);
      expect(/grant\s+all\s+on\s+public\.content_titles\s+to\s+service_role/i.test(sql)).toBe(true);
      expect(/grant[^;]*delete[^;]*content_titles[^;]*authenticated/i.test(sql)).toBe(false);
    });
  });
});
