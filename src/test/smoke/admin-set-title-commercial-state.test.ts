import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Batch 2 focused test — admin_set_title_commercial_state wiring.
 * Verifies the audited RPC contract without mounting the full admin console.
 */

type CallLog = { fn: string; args: unknown };

function makeSupabaseMock(opts: {
  rpcError?: string;
  upsertError?: string;
} = {}) {
  const calls: CallLog[] = [];
  const supabase = {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      if (fn === "admin_set_title_commercial_state" && opts.rpcError) {
        return { data: null, error: { message: opts.rpcError } };
      }
      return { data: null, error: null };
    }),
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => {
            calls.push({ fn: "title_commercial_profiles.upsert", args: null });
            if (opts.upsertError) return { data: null, error: { message: opts.upsertError } };
            return { data: { id: "profile-1" }, error: null };
          }),
        })),
      })),
    })),
  };
  return { supabase, calls };
}

/**
 * Simulates the saveProfile branch from TitleCommercialOpsConsole.
 * Kept in-test to avoid coupling the smoke suite to the full component tree.
 */
async function saveProfile(deps: {
  supabase: ReturnType<typeof makeSupabaseMock>["supabase"];
  titleId: string;
  initialStatus: string;
  initialPublished: boolean;
  nextStatus: string;
  nextPublished: boolean;
  reason: string;
}) {
  const stateChanged =
    deps.nextStatus !== deps.initialStatus ||
    deps.nextPublished !== deps.initialPublished;

  if (stateChanged && deps.reason.trim().length < 4) {
    return { ok: false, reason: "reason_too_short" as const };
  }
  if (stateChanged) {
    const { error } = await (deps.supabase as any).rpc("admin_set_title_commercial_state", {
      _title_id: deps.titleId,
      _new_status: deps.nextStatus,
      _published_to_buyers: deps.nextPublished,
      _reason: deps.reason.trim(),
    });
    if (error) return { ok: false, reason: "rpc_error" as const, message: error.message };
  }
  const { error: upErr } = await (deps.supabase as any)
    .from("title_commercial_profiles")
    .upsert({ title_id: deps.titleId }, { onConflict: "title_id" })
    .select("id")
    .maybeSingle();
  if (upErr) return { ok: false, reason: "upsert_error" as const, message: upErr.message };
  return { ok: true as const };
}

describe("admin_set_title_commercial_state · Batch 2 wiring", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips the RPC when neither status nor visibility changed", async () => {
    const { supabase, calls } = makeSupabaseMock();
    const res = await saveProfile({
      supabase, titleId: "t1",
      initialStatus: "licensing_open", initialPublished: true,
      nextStatus: "licensing_open", nextPublished: true,
      reason: "",
    });
    expect(res.ok).toBe(true);
    expect(calls.some(c => c.fn === "admin_set_title_commercial_state")).toBe(false);
    expect(calls.some(c => c.fn === "title_commercial_profiles.upsert")).toBe(true);
  });

  it("blocks save when status changed but reason is empty", async () => {
    const { supabase, calls } = makeSupabaseMock();
    const res = await saveProfile({
      supabase, titleId: "t1",
      initialStatus: "not_open", initialPublished: false,
      nextStatus: "licensing_open", nextPublished: true,
      reason: "   ",
    });
    expect(res).toEqual({ ok: false, reason: "reason_too_short" });
    expect(calls).toHaveLength(0);
  });

  it("calls the RPC with trimmed reason and forwards state + published flag", async () => {
    const { supabase, calls } = makeSupabaseMock();
    await saveProfile({
      supabase, titleId: "t42",
      initialStatus: "not_open", initialPublished: false,
      nextStatus: "licensing_open", nextPublished: true,
      reason: "  Opening for OTT licensing  ",
    });
    const rpc = calls.find(c => c.fn === "admin_set_title_commercial_state");
    expect(rpc).toBeDefined();
    expect(rpc!.args).toEqual({
      _title_id: "t42",
      _new_status: "licensing_open",
      _published_to_buyers: true,
      _reason: "Opening for OTT licensing",
    });
  });

  it("fires the RPC when only the visibility flag flips", async () => {
    const { supabase, calls } = makeSupabaseMock();
    await saveProfile({
      supabase, titleId: "t7",
      initialStatus: "licensing_open", initialPublished: false,
      nextStatus: "licensing_open", nextPublished: true,
      reason: "Publish to buyers after clearance",
    });
    expect(calls.some(c => c.fn === "admin_set_title_commercial_state")).toBe(true);
  });

  it("propagates RPC errors and skips the upsert", async () => {
    const { supabase, calls } = makeSupabaseMock({ rpcError: "forbidden" });
    const res = await saveProfile({
      supabase, titleId: "t1",
      initialStatus: "not_open", initialPublished: false,
      nextStatus: "invite_only", nextPublished: true,
      reason: "grant invite-only screening",
    });
    expect(res).toMatchObject({ ok: false, reason: "rpc_error", message: "forbidden" });
    expect(calls.some(c => c.fn === "title_commercial_profiles.upsert")).toBe(false);
  });

  it("uses only allow-listed RPC arguments (no confidential fields leaked)", async () => {
    const { supabase, calls } = makeSupabaseMock();
    await saveProfile({
      supabase, titleId: "t1",
      initialStatus: "not_open", initialPublished: false,
      nextStatus: "acquisition_open", nextPublished: true,
      reason: "Open acquisition track",
    });
    const rpc = calls.find(c => c.fn === "admin_set_title_commercial_state");
    const keys = Object.keys(rpc!.args as Record<string, unknown>).sort();
    expect(keys).toEqual([
      "_new_status",
      "_published_to_buyers",
      "_reason",
      "_title_id",
    ]);
  });
});
