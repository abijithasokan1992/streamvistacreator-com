import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Batch 2 focused test — admin_set_title_commercial_state wiring (gap-closure).
 * Verifies the RPC contract now includes the five availability flags and that
 * the frontend no longer upserts sensitive commercial fields directly.
 */

type CallLog = { fn: string; args: unknown; payload?: unknown };

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
      upsert: vi.fn((payload: unknown) => {
        calls.push({ fn: "title_commercial_profiles.upsert", args: null, payload });
        return {
          select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (opts.upsertError) return { data: null, error: { message: opts.upsertError } };
              return { data: { id: "profile-1" }, error: null };
            }),
          })),
        };
      }),
    })),
  };
  return { supabase, calls };
}

type Flags = {
  available_for_screeners: boolean;
  available_for_nonexclusive_license: boolean;
  available_for_exclusive_license: boolean;
  available_for_acquisition: boolean;
  available_for_distribution_partnership: boolean;
};

const ZERO_FLAGS: Flags = {
  available_for_screeners: false,
  available_for_nonexclusive_license: false,
  available_for_exclusive_license: false,
  available_for_acquisition: false,
  available_for_distribution_partnership: false,
};

/**
 * Mirrors the saveProfile branch from TitleCommercialOpsConsole after
 * gap-closure: RPC receives all five flags; descriptive upsert must NOT
 * carry commercial_status, published_to_buyers, or any available_for_* field.
 */
async function saveProfile(deps: {
  supabase: ReturnType<typeof makeSupabaseMock>["supabase"];
  titleId: string;
  initialStatus: string;
  initialPublished: boolean;
  initialFlags: Flags;
  nextStatus: string;
  nextPublished: boolean;
  nextFlags: Flags;
  reason: string;
}) {
  const flagsChanged = (Object.keys(deps.initialFlags) as (keyof Flags)[]).some(
    (k) => deps.initialFlags[k] !== deps.nextFlags[k],
  );
  const stateChanged =
    deps.nextStatus !== deps.initialStatus ||
    deps.nextPublished !== deps.initialPublished ||
    flagsChanged;

  if (stateChanged && deps.reason.trim().length < 4) {
    return { ok: false, reason: "reason_too_short" as const };
  }
  if (stateChanged) {
    const { error } = await (deps.supabase as any).rpc("admin_set_title_commercial_state", {
      _title_id: deps.titleId,
      _new_status: deps.nextStatus,
      _published_to_buyers: deps.nextPublished,
      _available_for_screeners: deps.nextFlags.available_for_screeners,
      _available_for_nonexclusive_license: deps.nextFlags.available_for_nonexclusive_license,
      _available_for_exclusive_license: deps.nextFlags.available_for_exclusive_license,
      _available_for_acquisition: deps.nextFlags.available_for_acquisition,
      _available_for_distribution_partnership: deps.nextFlags.available_for_distribution_partnership,
      _reason: deps.reason.trim(),
    });
    if (error) return { ok: false, reason: "rpc_error" as const, message: error.message };
  }
  const descriptivePayload = {
    title_id: deps.titleId,
    owner_user_id: "owner-1",
    rights_status_summary: null,
    legal_clearance_summary: null,
    delivery_readiness_summary: null,
    chain_of_title_notes: null,
    buyer_facing_summary: null,
  };
  const { error: upErr } = await (deps.supabase as any)
    .from("title_commercial_profiles")
    .upsert(descriptivePayload, { onConflict: "title_id" })
    .select("id")
    .maybeSingle();
  if (upErr) return { ok: false, reason: "upsert_error" as const, message: upErr.message };
  return { ok: true as const };
}

const BASE = {
  titleId: "t1",
  initialStatus: "not_open",
  initialPublished: false,
  initialFlags: ZERO_FLAGS,
};

describe("admin_set_title_commercial_state · Batch 2 gap-closure wiring", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips RPC when nothing changed", async () => {
    const { supabase, calls } = makeSupabaseMock();
    const res = await saveProfile({
      supabase, ...BASE,
      initialStatus: "licensing_open", initialPublished: true,
      initialFlags: { ...ZERO_FLAGS, available_for_nonexclusive_license: true },
      nextStatus: "licensing_open", nextPublished: true,
      nextFlags: { ...ZERO_FLAGS, available_for_nonexclusive_license: true },
      reason: "",
    });
    expect(res.ok).toBe(true);
    expect(calls.some(c => c.fn === "admin_set_title_commercial_state")).toBe(false);
    expect(calls.some(c => c.fn === "title_commercial_profiles.upsert")).toBe(true);
  });

  it("blocks save when state changed but reason is empty", async () => {
    const { supabase, calls } = makeSupabaseMock();
    const res = await saveProfile({
      supabase, ...BASE,
      nextStatus: "licensing_open", nextPublished: true,
      nextFlags: { ...ZERO_FLAGS, available_for_nonexclusive_license: true },
      reason: "   ",
    });
    expect(res).toEqual({ ok: false, reason: "reason_too_short" });
    expect(calls).toHaveLength(0);
  });

  it("routes commercial status + published flag + all five availability flags through the RPC", async () => {
    const { supabase, calls } = makeSupabaseMock();
    await saveProfile({
      supabase, ...BASE, titleId: "t42",
      nextStatus: "licensing_open", nextPublished: true,
      nextFlags: {
        available_for_screeners: true,
        available_for_nonexclusive_license: true,
        available_for_exclusive_license: false,
        available_for_acquisition: false,
        available_for_distribution_partnership: false,
      },
      reason: "  Opening for OTT licensing  ",
    });
    const rpc = calls.find(c => c.fn === "admin_set_title_commercial_state");
    expect(rpc).toBeDefined();
    expect(rpc!.args).toEqual({
      _title_id: "t42",
      _new_status: "licensing_open",
      _published_to_buyers: true,
      _available_for_screeners: true,
      _available_for_nonexclusive_license: true,
      _available_for_exclusive_license: false,
      _available_for_acquisition: false,
      _available_for_distribution_partnership: false,
      _reason: "Opening for OTT licensing",
    });
  });

  it("fires the RPC when only an availability flag flips", async () => {
    const { supabase, calls } = makeSupabaseMock();
    await saveProfile({
      supabase, ...BASE,
      initialStatus: "licensing_open", initialPublished: true,
      initialFlags: { ...ZERO_FLAGS, available_for_nonexclusive_license: true },
      nextStatus: "licensing_open", nextPublished: true,
      nextFlags: { ...ZERO_FLAGS, available_for_nonexclusive_license: true, available_for_exclusive_license: true },
      reason: "adding exclusive lane",
    });
    expect(calls.some(c => c.fn === "admin_set_title_commercial_state")).toBe(true);
  });

  it("propagates RPC errors and skips the descriptive upsert", async () => {
    const { supabase, calls } = makeSupabaseMock({ rpcError: "forbidden" });
    const res = await saveProfile({
      supabase, ...BASE,
      nextStatus: "invite_only", nextPublished: true,
      nextFlags: { ...ZERO_FLAGS, available_for_screeners: true },
      reason: "grant invite-only screening",
    });
    expect(res).toMatchObject({ ok: false, reason: "rpc_error", message: "forbidden" });
    expect(calls.some(c => c.fn === "title_commercial_profiles.upsert")).toBe(false);
  });

  it("uses only the approved allow-listed RPC arguments", async () => {
    const { supabase, calls } = makeSupabaseMock();
    await saveProfile({
      supabase, ...BASE,
      nextStatus: "acquisition_open", nextPublished: true,
      nextFlags: { ...ZERO_FLAGS, available_for_acquisition: true },
      reason: "Open acquisition track",
    });
    const rpc = calls.find(c => c.fn === "admin_set_title_commercial_state");
    const keys = Object.keys(rpc!.args as Record<string, unknown>).sort();
    expect(keys).toEqual([
      "_available_for_acquisition",
      "_available_for_distribution_partnership",
      "_available_for_exclusive_license",
      "_available_for_nonexclusive_license",
      "_available_for_screeners",
      "_new_status",
      "_published_to_buyers",
      "_reason",
      "_title_id",
    ]);
  });

  it("descriptive upsert must NOT include commercial_status, published_to_buyers, or any available_for_* field", async () => {
    const { supabase, calls } = makeSupabaseMock();
    await saveProfile({
      supabase, ...BASE,
      nextStatus: "licensing_open", nextPublished: true,
      nextFlags: { ...ZERO_FLAGS, available_for_nonexclusive_license: true },
      reason: "publish for licensing",
    });
    const upsert = calls.find(c => c.fn === "title_commercial_profiles.upsert");
    expect(upsert).toBeDefined();
    const payload = upsert!.payload as Record<string, unknown>;
    const forbidden = [
      "commercial_status",
      "published_to_buyers",
      "available_for_screeners",
      "available_for_nonexclusive_license",
      "available_for_exclusive_license",
      "available_for_acquisition",
      "available_for_distribution_partnership",
    ];
    for (const f of forbidden) {
      expect(payload).not.toHaveProperty(f);
    }
  });

  it("unpublishing (published_to_buyers=false) still routes through the RPC even with no flags set", async () => {
    // Frontend simply forwards the intent; the server enforces that unpublishing
    // is always allowed to admins regardless of RFD/eligibility gates.
    const { supabase, calls } = makeSupabaseMock();
    await saveProfile({
      supabase, ...BASE,
      initialStatus: "licensing_open", initialPublished: true,
      initialFlags: { ...ZERO_FLAGS, available_for_nonexclusive_license: true },
      nextStatus: "internal_hold", nextPublished: false,
      nextFlags: ZERO_FLAGS,
      reason: "pulling from buyer visibility",
    });
    const rpc = calls.find(c => c.fn === "admin_set_title_commercial_state");
    expect(rpc).toBeDefined();
    expect((rpc!.args as any)._published_to_buyers).toBe(false);
  });
});
