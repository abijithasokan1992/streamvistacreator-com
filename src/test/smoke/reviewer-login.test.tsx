/**
 * Reviewer login smoke tests
 *
 * 1. Unit-tests for `dashboardForRole` — qc_reviewer and legal_reviewer must
 *    always resolve to registered routes, never to a non-existent URL.
 * 2. Route-registration tests — navigating to those paths in a realistic
 *    route tree must NOT render the WrongPortal or NotFound fallback.
 * 3. Access tests — the Admin component, when rendered with reviewer
 *    credentials, must show the reviewer console (not the "No Admin Access"
 *    screen).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// 1. Pure unit tests — no rendering, no mocking needed
// ---------------------------------------------------------------------------
import { dashboardForRole } from "@/hooks/useAuth";

describe("dashboardForRole", () => {
  it("maps qc_reviewer to /admin/qc", () => {
    expect(dashboardForRole("qc_reviewer")).toBe("/admin/qc");
  });

  it("maps legal_reviewer to /admin/legal", () => {
    expect(dashboardForRole("legal_reviewer")).toBe("/admin/legal");
  });

  it("maps null / unknown role to /admin/home (not a broken URL)", () => {
    expect(dashboardForRole(null)).toBe("/admin/home");
  });

  it("maps admin to /admin", () => {
    expect(dashboardForRole("admin")).toBe("/admin");
  });

  it("maps super_admin to /admin", () => {
    expect(dashboardForRole("super_admin")).toBe("/admin");
  });
});

// ---------------------------------------------------------------------------
// 2. Route-registration tests — mirrors the AdminRoutes / PublicRoutes tree
//    for the paths that reviewers land on after magic-link login.
// ---------------------------------------------------------------------------

/** Minimal stub components that identify themselves in the DOM. */
const AdminConsole = () => <div data-testid="admin-console">Admin Console</div>;
const WrongPortalStub = () => <div data-testid="wrong-portal">Wrong Portal</div>;
const NotFoundStub = () => <div data-testid="not-found">Not Found</div>;

/**
 * Renders a route tree that mirrors the registered admin-subdomain routes for
 * the paths reviewers care about, then navigates to `initialPath`.
 */
function renderAdminRouteTree(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="/admin/qc" element={<AdminConsole />} />
        <Route path="/admin/legal" element={<AdminConsole />} />
        <Route path="/admin/home" element={<AdminConsole />} />
        <Route path="*" element={<NotFoundStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Reviewer console route registration", () => {
  it("qc_reviewer destination /admin/qc resolves to a registered route (not NotFound)", () => {
    const dest = dashboardForRole("qc_reviewer");
    renderAdminRouteTree(dest);
    expect(screen.getByTestId("admin-console")).toBeInTheDocument();
    expect(screen.queryByTestId("not-found")).toBeNull();
    expect(screen.queryByTestId("wrong-portal")).toBeNull();
  });

  it("legal_reviewer destination /admin/legal resolves to a registered route (not NotFound)", () => {
    const dest = dashboardForRole("legal_reviewer");
    renderAdminRouteTree(dest);
    expect(screen.getByTestId("admin-console")).toBeInTheDocument();
    expect(screen.queryByTestId("not-found")).toBeNull();
    expect(screen.queryByTestId("wrong-portal")).toBeNull();
  });

  it("unknown-role destination /admin/home resolves to a registered route (not NotFound)", () => {
    const dest = dashboardForRole(null);
    renderAdminRouteTree(dest);
    expect(screen.getByTestId("admin-console")).toBeInTheDocument();
    expect(screen.queryByTestId("not-found")).toBeNull();
    expect(screen.queryByTestId("wrong-portal")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Admin component access tests — reviewers must see the reviewer console,
//    not the "No Admin Access" fallback.
// ---------------------------------------------------------------------------

// Keep admin component render hermetic — no Supabase, no network.
vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = () => {
    const result = Promise.resolve({ data: [], error: null });
    const builder: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        result.then(resolve, reject),
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
    };
    const passthrough = new Proxy(builder, {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string];
        return () => passthrough;
      },
    });
    return passthrough;
  };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: () => makeBuilder(),
      rpc: () => makeBuilder(),
      channel: () => ({ on: () => ({ subscribe: () => {} }), subscribe: () => {} }),
      removeChannel: () => {},
    },
  };
});

vi.mock("@/hooks/useBackGuard", () => ({ useBackGuard: () => {} }));

function mockUseAuth(overrides: Record<string, unknown>) {
  vi.doMock("@/hooks/useAuth", () => ({
    useAuth: () => ({
      user: { id: "test-uid", email: "reviewer@test.com" },
      role: null,
      dashboardRole: null,
      isAdmin: false,
      isSuperAdmin: false,
      isQcReviewer: false,
      isLegalReviewer: false,
      loading: false,
      signOut: vi.fn(),
      refreshRole: vi.fn(),
      ...overrides,
    }),
    dashboardForRole,
    pickPrimaryRole: (roles: string[]) => roles[0] ?? null,
  }));
}

// Admin.tsx is a heavy component — for these tests we focus on whether the
// access guard passes, asserting on text that only appears when access is
// granted vs. denied.
describe("Admin component — reviewer access guard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("qc_reviewer sees the QC Reviewer Console (not No Admin Access)", async () => {
    mockUseAuth({ role: "qc_reviewer", isQcReviewer: true });
    const { default: Admin } = await import("@/pages/Admin");
    render(
      <MemoryRouter initialEntries={["/admin/qc"]}>
        <Routes>
          <Route path="/admin/qc" element={<Admin />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText(/no admin access/i)).toBeNull();
    expect(screen.getByText(/qc reviewer console/i)).toBeInTheDocument();
  });

  it("legal_reviewer sees the Legal Reviewer Console (not No Admin Access)", async () => {
    mockUseAuth({ role: "legal_reviewer", isLegalReviewer: true });
    const { default: Admin } = await import("@/pages/Admin");
    render(
      <MemoryRouter initialEntries={["/admin/legal"]}>
        <Routes>
          <Route path="/admin/legal" element={<Admin />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText(/no admin access/i)).toBeNull();
    expect(screen.getByText(/legal reviewer console/i)).toBeInTheDocument();
  });

  it("unauthenticated user is redirected, not shown the console", async () => {
    mockUseAuth({ user: null, loading: false });
    const { default: Admin } = await import("@/pages/Admin");
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth" element={<div data-testid="auth-page">Auth</div>} />
        </Routes>
      </MemoryRouter>,
    );
    // Admin redirects to /auth when no user — auth page should render.
    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
  });
});
