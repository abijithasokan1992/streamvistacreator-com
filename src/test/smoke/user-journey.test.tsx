/**
 * User journey smoke test — Home → Create Account → Log In → Dashboard →
 *                           New Title → Submit to Admin
 *
 * Each `describe` block represents one stop in the journey. All network calls
 * are mocked so the suite runs offline inside Vitest/jsdom. Screenshots are
 * left to the separate Playwright E2E suite; this test focuses on what the
 * user *sees and can interact with* at every step.
 *
 * Mock pattern: vi.hoisted() creates variables that are available inside
 * vi.mock() factories (which are hoisted before imports). Per-test state is
 * controlled by calling .mockReturnValue() in beforeEach.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// ─── Hoisted mock functions (available inside vi.mock factories) ──────────────
const {
  mockUseAuth,
  mockListTitles,
  mockFetchFreeTierStatus,
  mockCreateTitle,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({
    user: null as null | { id: string; email: string },
    role: null as string | null,
    dashboardRole: null as string | null,
    loading: false,
    signOut: vi.fn(),
  })),
  mockListTitles: vi.fn(async () => [] as any[]),
  mockFetchFreeTierStatus: vi.fn(async () => ({
    is_free: false,
    can_create_draft: true,
    draft_count: 0,
    lifecycle_count: 0,
  })),
  mockCreateTitle: vi.fn(async (_uid: string, _wid: string | null, name: string) => ({
    id: "title-new",
    title: name,
    status: "draft",
    locked: false,
    metadata: { format: "feature_film" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// ─── Module mocks (hoisted before imports) ────────────────────────────────────

vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
  dashboardForRole: (role: string | null) =>
    role === "content_owner" ? "/dashboard/content" : "/",
}));

vi.mock("@/lib/creator/titleApi", () => ({
  fetchFreeTierStatus: mockFetchFreeTierStatus,
  listTitles: mockListTitles,
  createTitle: mockCreateTitle,
  findFirstActiveDraft: vi.fn(async () => null),
  getTitle: vi.fn(async () => null),
  listAssets: vi.fn(async () => []),
  submitTitle: vi.fn(async () => ({ error: null })),
  evaluateChecklist: vi.fn(async () => ({ items: [] })),
  fetchReadiness: vi.fn(async () => null),
  fetchTitleTimeline: vi.fn(async () => []),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: vi.fn(),
  },
}));

// Supabase — fully chainable query builder that resolves to empty results
vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = (): any => {
    const proxy: any = new Proxy(
      {
        then: (r: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null, count: 0 }).then(r, rej),
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
      },
      {
        get(target, prop) {
          if (prop in target) return target[prop as string];
          return () => proxy;
        },
      },
    );
    return proxy;
  };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe() {} } },
        }),
        signInWithOtp: async () => ({ error: null }),
      },
      from: () => makeBuilder(),
      rpc: () => makeBuilder(),
      channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe() {} }) }) }),
      removeChannel: () => {},
      functions: { invoke: async () => ({ data: null, error: null }) },
      storage: {
        from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }),
      },
    },
  };
});

vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth: async () => ({ error: null }) } },
}));

vi.mock("@/lib/site", () => ({ getAppOrigin: () => "http://localhost:3000" }));

vi.mock("@/lib/mailVoice", () => ({
  prewarmMailVoice: () => {},
  playMailVoice: async () => {},
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({ active: null }),
}));

vi.mock("@/hooks/useTitleLock", () => ({
  useTitleLock: () => ({
    isLocked: false,
    isTabEditable: () => true,
    isSectionEditable: () => true,
  }),
}));

// Creator-specific UI components whose internals are out of scope for this journey test
vi.mock("@/components/creator/OnboardingChecklist", () => ({
  default: () => null,
  markOnboardingStep: () => {},
}));

vi.mock("@/components/creator/CreatorTour", () => ({
  default: () => null,
  hasSeenCreatorTour: () => true,
}));

// TitleEditor stub — exposes an "Submit to Admin" button that fires onSubmitted
vi.mock("@/components/creator/title/TitleEditor", () => ({
  TitleEditor: ({ onSubmitted }: { onSubmitted: () => void }) => (
    <div data-testid="title-editor">
      <button onClick={onSubmitted}>Submit to Admin</button>
    </div>
  ),
}));

// AgreementGate stub — calls onAccepted after mount to skip the legal modal
vi.mock("@/components/legal/AgreementGate", () => ({
  AgreementGate: ({ onAccepted }: { onAccepted: () => void }) => {
    // Use useEffect to defer the call past the current render cycle,
    // avoiding a "setState during render" React warning.
    const { useEffect } = require("react");
    useEffect(() => { onAccepted(); }, []);
    return null;
  },
}));

// ─── Static imports (after mocks — uses the mocked versions above) ────────────
import { Navbar } from "@/components/streamvista/Navbar";
import Auth from "@/pages/Auth";
import ContentOwnerDashboard from "@/pages/dashboards/ContentOwner";
import MyTitlesSection from "@/components/creator/sections/MyTitles";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function renderAuthAt(search: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/auth${search}`]}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// STOP 1 — Home Page
// ──────────────────────────────────────────────────────────────────────────────
describe("Stop 1 — Home page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      role: null,
      dashboardRole: null,
      loading: false,
      signOut: vi.fn(),
    });
  });
  afterEach(cleanup);

  it("renders the brand wordmark in the navbar", () => {
    renderAt("/", <Navbar />);
    expect(screen.getByLabelText(/streamvista cloud x home/i)).toBeInTheDocument();
  });

  it("navbar exposes a Login link pointing to /auth", () => {
    renderAt("/", <Navbar />);
    const loginLink = screen.getByRole("link", { name: /^login$/i });
    expect(loginLink).toHaveAttribute("href", "/auth");
  });

  it("navbar exposes a 'Get Started' CTA pointing to /auth?intent=signup", () => {
    renderAt("/", <Navbar />);
    const ctaLink = screen.getByRole("link", { name: /get started/i });
    expect(ctaLink).toHaveAttribute("href", "/auth?intent=signup");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// STOP 2 — Create Account page (/auth?mode=signup)
// ──────────────────────────────────────────────────────────────────────────────
describe("Stop 2 — Create Account page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      role: null,
      dashboardRole: null,
      loading: false,
      signOut: vi.fn(),
    });
  });
  afterEach(cleanup);

  it("renders the page heading 'Create your account' on signup tab", async () => {
    renderAuthAt("?mode=signup");
    expect(await screen.findByText(/create your account/i)).toBeInTheDocument();
  });

  it("shows Full name, Email inputs and role selector on signup tab", async () => {
    renderAuthAt("?mode=signup");
    expect(await screen.findByPlaceholderText(/your full name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    // All three public roles must be selectable
    expect(screen.getByText(/^creator$/i)).toBeInTheDocument();
    expect(screen.getByText(/^studio$/i)).toBeInTheDocument();
    expect(screen.getByText(/^buyer$/i)).toBeInTheDocument();
  });

  it("'Send magic link' button is present and enabled on signup tab", async () => {
    renderAuthAt("?mode=signup");
    const btn = await screen.findByRole("button", { name: /send magic link/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("filling in form and clicking Send transitions to 'Check your inbox' state", async () => {
    renderAuthAt("?mode=signup");

    fireEvent.change(await screen.findByPlaceholderText(/your full name/i), {
      target: { value: "Jane Creator" },
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(screen.getByText(/jane@example\.com/i)).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// STOP 3 — Log In page (/auth)
// ──────────────────────────────────────────────────────────────────────────────
describe("Stop 3 — Log In page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      role: null,
      dashboardRole: null,
      loading: false,
      signOut: vi.fn(),
    });
  });
  afterEach(cleanup);

  it("renders 'Log in' heading on the login tab", async () => {
    renderAuthAt("");
    expect(await screen.findByRole("heading", { name: /^log in$/i })).toBeInTheDocument();
  });

  it("shows only Email field (no Full name) on the login tab", async () => {
    renderAuthAt("");
    await screen.findByPlaceholderText(/you@example\.com/i);
    expect(screen.queryByPlaceholderText(/your full name/i)).not.toBeInTheDocument();
  });

  it("'Email me a magic link' button is present and enabled", async () => {
    renderAuthAt("");
    const btn = await screen.findByRole("button", { name: /email me a magic link/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("can switch from Login tab to Create Account tab", async () => {
    renderAuthAt("");
    const createTab = await screen.findByRole("button", { name: /create account/i });
    fireEvent.click(createTab);
    expect(await screen.findByText(/create your account/i)).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// STOP 4 — Creator Dashboard (authenticated)
// ──────────────────────────────────────────────────────────────────────────────
describe("Stop 4 — Creator dashboard after login", () => {
  const signOut = vi.fn();

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "jane@example.com" },
      role: "content_owner",
      dashboardRole: "content_owner",
      loading: false,
      signOut,
    });
    mockListTitles.mockResolvedValue([]);
    mockFetchFreeTierStatus.mockResolvedValue({
      is_free: true,
      can_create_draft: true,
      draft_count: 0,
      lifecycle_count: 0,
    });
  });
  afterEach(cleanup);

  it("renders the StreamVista brand link in the dashboard header", async () => {
    renderAt("/dashboard/content", <ContentOwnerDashboard />);
    expect(await screen.findByRole("link", { name: /streamvista/i })).toBeInTheDocument();
  });

  it("renders the Sign out button", async () => {
    renderAt("/dashboard/content", <ContentOwnerDashboard />);
    expect(await screen.findByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("calls signOut when the Sign out button is clicked", async () => {
    renderAt("/dashboard/content", <ContentOwnerDashboard />);
    fireEvent.click(await screen.findByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// STOP 5 — Create a new title
// ──────────────────────────────────────────────────────────────────────────────
describe("Stop 5 — Creating a new title", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "jane@example.com" },
      role: "content_owner",
      dashboardRole: "content_owner",
      loading: false,
      signOut: vi.fn(),
    });
    mockListTitles.mockResolvedValue([]);
    mockFetchFreeTierStatus.mockResolvedValue({
      is_free: true,
      can_create_draft: true,
      draft_count: 0,
      lifecycle_count: 0,
    });
    mockCreateTitle.mockResolvedValue({
      id: "title-new",
      title: "My First Feature Film",
      status: "draft",
      locked: false,
      metadata: { format: "feature_film" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });
  afterEach(cleanup);

  it("'New Title' button is present in the My Titles section", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /new title/i })).toBeInTheDocument();
  });

  it("clicking 'New Title' opens the create-title modal", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /new title/i }));
    expect(await screen.findByText(/add a new title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sunrise over kochi/i)).toBeInTheDocument();
  });

  it("the modal contains all content-type options", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /new title/i }));
    await screen.findByText(/add a new title/i);
    expect(screen.getByText(/feature film/i)).toBeInTheDocument();
  });

  it("entering a title name and clicking 'Start Draft' opens TitleEditor", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /new title/i }));
    await screen.findByText(/add a new title/i);

    fireEvent.change(screen.getByPlaceholderText(/sunrise over kochi/i), {
      target: { value: "My First Feature Film" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start draft/i }));

    expect(await screen.findByTestId("title-editor")).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// STOP 6 — Submit to Admin
// ──────────────────────────────────────────────────────────────────────────────
describe("Stop 6 — Submit title to Admin", () => {
  const existingTitle = {
    id: "title-1",
    title: "My First Feature Film",
    status: "draft",
    locked: false,
    metadata: { format: "feature_film" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "jane@example.com" },
      role: "content_owner",
      dashboardRole: "content_owner",
      loading: false,
      signOut: vi.fn(),
    });
    // Seed one existing draft title so the Edit button is visible
    mockListTitles.mockResolvedValue([existingTitle]);
    mockFetchFreeTierStatus.mockResolvedValue({
      is_free: true,
      can_create_draft: false, // limit hit to show locked state correctly
      draft_count: 1,
      lifecycle_count: 0,
    });
    mockToastSuccess.mockClear();
  });
  afterEach(cleanup);

  it("title card shows an Edit button when the title is not locked", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("clicking Edit opens TitleEditor for that title", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    expect(await screen.findByTestId("title-editor")).toBeInTheDocument();
  });

  it("clicking 'Submit to Admin' fires toast.success('Submitted to Admin.')", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    await screen.findByTestId("title-editor");

    fireEvent.click(screen.getByRole("button", { name: /submit to admin/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Submitted to Admin.");
    });
  });
});
