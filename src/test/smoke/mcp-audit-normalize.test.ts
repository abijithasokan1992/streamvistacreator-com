import { describe, it, expect } from "vitest";
import {
  normalizeAuditRow,
  filterAudit,
  redactError,
  displayEmail,
  displayUserId,
  UNKNOWN,
  type RawAuditRow,
} from "@/lib/mcp/auditNormalize";

const iso = "2026-07-17T20:19:26.000Z";

function row(overrides: Partial<RawAuditRow> = {}): RawAuditRow {
  return {
    id: "row-1",
    created_at: iso,
    action: "list_titles",
    resource: "titles",
    permission_key: "allow_db_read",
    allowed: true,
    actor_email: "alice@example.com",
    actor_user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    details: { correlation_id: "cid-1", duration_ms: 42, client_id: "cli-1" },
    ...overrides,
  };
}

describe("mcp audit normalize · Phase C", () => {
  it("renders every field for a modern instrumented row", () => {
    const n = normalizeAuditRow(row());
    expect(n.decision).toBe("allowed");
    expect(n.outcome).toBe("success");
    expect(n.category).toBe("db_read");
    expect(n.correlationId).toBe("cid-1");
    expect(n.durationMs).toBe(42);
    expect(n.clientId).toBe("cli-1");
    expect(n.actorEmail).toMatch(/@example\.com$/);
    expect(n.actorEmail.startsWith("a")).toBe(true); // masked, not raw
    expect(n.timestampIso).toBe(iso);
    expect(n.timestampLabel).not.toBe(UNKNOWN);
  });

  it("emits Unknown/not recorded for legacy rows missing details", () => {
    const n = normalizeAuditRow(row({ details: null, actor_user_id: null }));
    expect(n.correlationId).toBe(UNKNOWN);
    expect(n.clientId).toBe(UNKNOWN);
    expect(n.durationMs).toBeNull();
    expect(n.actorUserId).toBe(UNKNOWN);
  });

  it("classifies denied vs error vs allowed", () => {
    expect(normalizeAuditRow(row({ allowed: false })).decision).toBe("denied");
    expect(
      normalizeAuditRow(row({ allowed: false, details: { error: "boom" } })).decision,
    ).toBe("error");
    // an errored but "allowed=true" row is still an error (defensive)
    expect(
      normalizeAuditRow(row({ allowed: true, details: { error: "boom" } })).decision,
    ).toBe("error");
  });

  it("redacts JWTs / bearer tokens / emails from error messages", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb";
    const r = redactError(`failed with token ${jwt} for user root@evil.example`);
    expect(r).not.toContain(jwt);
    expect(r).not.toContain("root@evil.example");
    expect(r).toContain("[REDACTED_JWT]");
  });

  it("filters by decision", () => {
    const rows = [
      normalizeAuditRow(row({ id: "1", allowed: true })),
      normalizeAuditRow(row({ id: "2", allowed: false })),
      normalizeAuditRow(row({ id: "3", allowed: false, details: { error: "x" } })),
    ];
    expect(filterAudit(rows, "all")).toHaveLength(3);
    expect(filterAudit(rows, "allowed").map((r) => r.id)).toEqual(["1"]);
    expect(filterAudit(rows, "denied").map((r) => r.id)).toEqual(["2"]);
    expect(filterAudit(rows, "error").map((r) => r.id)).toEqual(["3"]);
  });

  it("masks PII in list rendering", () => {
    expect(displayEmail("bob@example.com")).toBe("b•b@example.com");
    expect(displayEmail(null)).toBe(UNKNOWN);
    expect(displayUserId("aaaaaaaa-bbbb")).toContain("…");
    expect(displayUserId(null)).toBe(UNKNOWN);
  });
});
