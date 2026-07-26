import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

/**
 * P0 #1 — Mission signals guard.
 * Non-admin callers must not fan out queries against admin-only tables.
 * The hook returns an empty snapshot and skips every from()/rpc() call.
 */

const fromSpy = vi.fn();
const rpcSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => {
      fromSpy(...args);
      return {
        select: () => ({
          eq: () => Promise.resolve({ count: 3, error: null, data: [] }),
        }),
      };
    },
    rpc: (...args: any[]) => {
      rpcSpy(...args);
      return Promise.resolve({ data: [{ failed_uploads: 1, failed_emails: 2 }], error: null });
    },
  },
}));

let authStub: any = { isAdmin: false, isSuperAdmin: false, loading: false };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authStub,
}));

import { useMissionSignals } from "@/components/admin/hooks/useMissionSignals";

beforeEach(() => {
  fromSpy.mockClear();
  rpcSpy.mockClear();
});

describe("useMissionSignals guard", () => {
  it("does not query anything for non-admin users", async () => {
    authStub = { isAdmin: false, isSuperAdmin: false, loading: false };
    const { result } = renderHook(() => useMissionSignals(0));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fromSpy).not.toHaveBeenCalled();
    expect(rpcSpy).not.toHaveBeenCalled();
    expect(result.current.signals).toEqual([]);
    expect(result.current.totalOpen).toBe(0);
    expect(result.current.health.status).toBe("green");
  });

  it("waits while auth is loading and never queries", async () => {
    authStub = { isAdmin: false, isSuperAdmin: false, loading: true };
    renderHook(() => useMissionSignals(0));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("runs queries when the caller is an admin", async () => {
    authStub = { isAdmin: true, isSuperAdmin: false, loading: false };
    const { result } = renderHook(() => useMissionSignals(0));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(rpcSpy).toHaveBeenCalledWith("admin_failure_counts", expect.any(Object));
    expect(fromSpy).toHaveBeenCalled();
  });
});
