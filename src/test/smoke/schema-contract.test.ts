/**
 * Static schema-contract test. Guards against future references to columns
 * that have been removed from the live schema. Extracts the `Row` shape of
 * a handful of high-traffic tables straight from the generated Supabase
 * types and asserts required columns are present and dropped columns are
 * absent. If somebody re-adds a stale column name in a query, this test
 * fails at build time — no runtime 500 needed.
 */
import { describe, it, expectTypeOf, expect } from "vitest";
import type { Database } from "@/integrations/supabase/types";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

describe("schema contract — live column set", () => {
  it("ingest_telemetry has severity (used by platform-readiness) and no `successful`", () => {
    expectTypeOf<Row<"ingest_telemetry">>().toHaveProperty("severity");
    // @ts-expect-error `successful` was never a real column
    type _NoSuccessful = Row<"ingest_telemetry">["successful"];
    expect(true).toBe(true);
  });

  it("deal_memos has approval_status and no `signed_at`", () => {
    expectTypeOf<Row<"deal_memos">>().toHaveProperty("approval_status");
    // @ts-expect-error `signed_at` is not present in generated types
    type _NoSignedAt = Row<"deal_memos">["signed_at"];
    expect(true).toBe(true);
  });

  it("ingest_job_items uses file_name (not filename)", () => {
    expectTypeOf<Row<"ingest_job_items">>().toHaveProperty("file_name");
    // @ts-expect-error legacy column name
    type _NoFilename = Row<"ingest_job_items">["filename"];
    expect(true).toBe(true);
  });

  it("email_send_log uses template_name", () => {
    expectTypeOf<Row<"email_send_log">>().toHaveProperty("template_name");
    // @ts-expect-error legacy alias
    type _NoTemplate = Row<"email_send_log">["template"];
    expect(true).toBe(true);
  });

  it("entity_profiles has no `slug` column", () => {
    // @ts-expect-error slug was never introduced
    type _NoSlug = Row<"entity_profiles">["slug"];
    expect(true).toBe(true);
  });
});
