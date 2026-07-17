import { describe, it, expect } from "vitest";
import {
  startEnvelope,
  finishEnvelope,
  newCorrelationId,
  categoryForPermission,
} from "@/lib/mcp/auditInstrument";

describe("mcp audit instrumentation · Phase C envelope", () => {
  it("newCorrelationId returns a stable-shape opaque id", () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(6);
  });

  it("envelope carries correlation id + duration + decision + category", async () => {
    const start = startEnvelope("db_read");
    await new Promise((r) => setTimeout(r, 5));
    const done = finishEnvelope(start, "allowed");
    expect(done.correlation_id).toBe(start.correlation_id);
    expect(done.category).toBe("db_read");
    expect(done.decision).toBe("allowed");
    expect(typeof done.duration_ms).toBe("number");
    expect(done.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("error envelopes carry redacted error metadata but no raw secrets", () => {
    const start = startEnvelope("db_write");
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbb";
    const done = finishEnvelope(start, "error", { message: `boom ${jwt}`, code: "runtime_error" });
    expect(done.decision).toBe("error");
    expect(JSON.stringify(done)).not.toContain(jwt);
  });

  it("categoryForPermission maps every known permission key", () => {
    expect(categoryForPermission("allow_db_read")).toBe("db_read");
    expect(categoryForPermission("allow_db_write")).toBe("db_write");
    expect(categoryForPermission("allow_storage_read")).toBe("storage_read");
    expect(categoryForPermission("allow_storage_write")).toBe("storage_write");
    expect(categoryForPermission("allow_edge_invoke")).toBe("edge_invoke");
    expect(categoryForPermission("allow_user_data_export")).toBe("user_data_export");
    expect(categoryForPermission("master_kill_switch")).toBe("control");
  });
});
