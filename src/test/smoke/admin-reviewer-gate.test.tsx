import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Minimal Supabase stub — the panel only queries onboarding_requests for admins;
// reviewers never trigger the load path, so we return empty.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => undefined,
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useBackGuard", () => ({ useBackGuard: () => undefined }));

// The panel is heavy — mock the sub-components so this test stays a smoke test
// of the gate/RBAC logic, not a full render of every admin surface.
vi.mock("@/components/admin/OnboardingApprovals", () => ({ default: () => <div>onboarding approvals</div> }));
vi.mock("@/components/admin/ContentReviewWorkflow", () => ({
  default: ({ initialTab }: { initialTab?: string }) => (
    <div data-testid="content-review" data-initial-tab={initialTab ?? "none"}>content review</div>
  ),
}));

let authStub: any = null;
vi.mock("@/hooks/useAuth", async () => {
  const actual = await vi.importActual<any>("@/hooks/useAuth");
  return {
    ...actual,
    useAuth: () => authStub,
  };
});

import Admin from "@/pages/Admin";

const baseAuth = {
  user: { id: "u1", email: "reviewer@streamvista.test" },
  role: null as string | null,
  dashboardRole: null,
  loading: false,
  signOut: vi.fn(),
  isAdmin: false,
  isSuperAdmin: false,
  isQcReviewer: false,
  isLegalReviewer: false,
};

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Admin />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Admin.tsx reviewer gate", () => {
  it("blocks a signed-in user with no reviewer/admin role", async () => {
    authStub = { ...baseAuth };
    renderAt("/admin");
    await waitFor(() => expect(screen.getByText(/No Admin Access/i)).toBeInTheDocument());
  });

  it("allows qc_reviewer through /admin/qc and pins them to QC review", async () => {
    authStub = { ...baseAuth, role: "qc_reviewer", isQcReviewer: true };
    renderAt("/admin/qc");
    await waitFor(() => {
      expect(screen.queryByText(/No Admin Access/i)).not.toBeInTheDocument();
      expect(screen.getByText(/QC Reviewer Console/i)).toBeInTheDocument();
    });
    const panel = await screen.findByTestId("content-review");
    expect(panel.getAttribute("data-initial-tab")).toBe("qc_review");
  });

  it("allows legal_reviewer through /admin/legal and pins them to Legal review", async () => {
    authStub = { ...baseAuth, role: "legal_reviewer", isLegalReviewer: true };
    renderAt("/admin/legal");
    await waitFor(() => {
      expect(screen.queryByText(/No Admin Access/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Legal Reviewer Console/i)).toBeInTheDocument();
    });
    const panel = await screen.findByTestId("content-review");
    expect(panel.getAttribute("data-initial-tab")).toBe("legal_review");
  });

  it("still lets admins through and preserves full Admin Console header", async () => {
    authStub = { ...baseAuth, role: "admin", isAdmin: true };
    renderAt("/admin");
    await waitFor(() => {
      expect(screen.getByText(/Admin Console/i)).toBeInTheDocument();
      expect(screen.queryByText(/QC Reviewer Console/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Legal Reviewer Console/i)).not.toBeInTheDocument();
    });
  });
});
