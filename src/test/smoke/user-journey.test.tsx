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
import { useEffect } from "react";

// ─── Hoisted mock functions (available inside vi.mock factories) ──────────────
const {
  mockUseAuth,
  mockListTitles,
  mockFetchFreeTierStatus,
  mockCreateTitle,
  mockGetTitle,
  mockListAssets,
  mockSubmitTitle,
  mockEvaluateChecklist,
  mockFetchReadiness,
  mockFetchTitleTimeline,
  mockSaveTitleMetadata,
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
  mockListTitles: vi.fn(async () => [] as unknown[]),
  mockFetchFreeTierStatus: vi.fn(async () => ({
    is_free: false,
    can_create_draft: true,
    draft_count: 0,
    lifecycle_count: 0,
  } as any)),
  mockCreateTitle: vi.fn(async (_uid: string, _wid: string | null, _name: string) => ({
    id: "title-new",
    title: _name,
    owner_user_id: _uid,
    workspace_id: _wid,
    synopsis: null,
    language: null,
    genre: null,
    duration_minutes: null,
    status: "draft",
    locked: false,
    locked_at: null,
    submitted_at: null,
    approved_at: null,
    published_at: null,
    metadata: {
      format: "feature_film",
      synopsis: "",
      genres: [],
      runtime_minutes: 0,
      production_company: "",
      original_language: "",
      rights_owner: "",
      commercial: {
        engagement_mode: "free_listing",
        rights: { digital_ott: "available" },
        territories: { worldwide: "available" },
      },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  mockGetTitle: vi.fn(async (id: string) => ({
    id,
    owner_user_id: "user-1",
    workspace_id: "workspace-1",
    title: "My First Feature Film",
    synopsis: null,
    language: null,
    genre: null,
    duration_minutes: null,
    status: "draft",
    locked: false,
    locked_at: null,
    submitted_at: null,
    approved_at: null,
    published_at: null,
    metadata: {
      format: "feature_film",
      synopsis: "",
      genres: [],
      runtime_minutes: 0,
      production_company: "",
      original_language: "",
      rights_owner: "",
      commercial: {
        engagement_mode: "free_listing",
        rights: { digital_ott: "available" },
        territories: { worldwide: "available" },
      },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  mockListAssets: vi.fn(async () => [] as unknown[]),
  mockSubmitTitle: vi.fn(async () => undefined),
  mockEvaluateChecklist: vi.fn(() => ({
    hasTitle: true,
    hasSynopsis: false,
    hasFilm: false,
    hasTrailer: false,
    hasPoster: false,
    hasCensor: false,
    hasOwnership: false,
    censorRequired: true,
    ready: false,
    missing: ["Synopsis", "Trailer", "Poster", "Censor Certificate", "Ownership Documents"],
  })),
  mockFetchReadiness: vi.fn(async () => null),
  mockFetchTitleTimeline: vi.fn(async () => []),
  mockSaveTitleMetadata: vi.fn(async () => undefined),
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
  listTitlesPage: vi.fn(async () => ({ rows: [], hasMore: false })),
  createTitle: mockCreateTitle,
  findFirstActiveDraft: vi.fn(async () => null),
  getTitle: mockGetTitle,
  listAssets: mockListAssets,
  submitTitle: mockSubmitTitle,
  evaluateChecklist: mockEvaluateChecklist,
  fetchReadiness: mockFetchReadiness,
  fetchTitleTimeline: mockFetchTitleTimeline,
  saveTitleMetadata: mockSaveTitleMetadata,
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
  const makeBuilder = () => {
    const proxy = new Proxy(
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
      channel: () => {
        const ch: any = {};
        ch.on = () => ch;
        ch.subscribe = () => ch;
        ch.unsubscribe = () => ch;
        return ch;
      },
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
  useWorkspaces: () => ({ active: { id: "workspace-1" } }),
}));

vi.mock("@/hooks/useTitleLock", () => ({
  useTitleLock: () => ({
    isLocked: false,
    unlocks: [],
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

// LanguagePicker blocks the dashboard until a language is chosen — skip it in tests.
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => ({ chosen: true, locale: "en", setLocale: () => {} }),
}));
vi.mock("@/components/i18n/LanguagePicker", () => ({ default: () => null }));

// AgreementGate stub — calls onAccepted after mount to skip the legal modal
vi.mock("@/components/legal/AgreementGate", () => ({
  AgreementGate: ({ onAccepted }: { onAccepted: () => void }) => {
    // Defer past the current render cycle to avoid "setState during render".
    useEffect(() => { onAccepted(); }, [onAccepted]);
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
    expect(screen.getByLabelText(/streamvista home/i)).toBeInTheDocument();
  });

  it("navbar exposes a Login link pointing to /auth", () => {
    renderAt("/", <Navbar />);
    const loginLink = screen.getByRole("link", { name: /log in to streamvista/i });
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
    } as any);
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
    owner_user_id: "user-1",
    workspace_id: "workspace-1",
    title: "My First Feature Film",
    synopsis: null,
    language: null,
    genre: null,
    duration_minutes: null,
    status: "draft",
    locked: false,
    locked_at: null,
    submitted_at: null,
    approved_at: null,
    published_at: null,
    metadata: {
      format: "feature_film",
      synopsis: "A complete synopsis for admin review.",
      genres: ["Drama"],
      runtime_minutes: 122,
      production_company: "Sunrise Studios",
      original_language: "Malayalam",
      rights_owner: "Sunrise Studios",
      commercial: {
        engagement_mode: "free_listing",
        rights: { digital_ott: "available" },
        territories: { worldwide: "available" },
      },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const trailerOnlyReadyAssets = [
    {
      id: "asset-trailer",
      title_id: "title-1",
      upload_id: "upload-trailer",
      category: "trailer",
      is_primary: true,
      created_at: new Date().toISOString(),
      upload: {
        id: "upload-trailer",
        file_name: "trailer.mp4",
        file_size: 1024,
        mime_type: "video/mp4",
        status: "ready",
        object_key: "trailer.mp4",
        created_at: new Date().toISOString(),
      },
    },
    {
      id: "asset-poster",
      title_id: "title-1",
      upload_id: "upload-poster",
      category: "poster",
      is_primary: true,
      created_at: new Date().toISOString(),
      upload: {
        id: "upload-poster",
        file_name: "poster.jpg",
        file_size: 1024,
        mime_type: "image/jpeg",
        status: "ready",
        object_key: "poster.jpg",
        created_at: new Date().toISOString(),
      },
    },
    {
      id: "asset-censor",
      title_id: "title-1",
      upload_id: "upload-censor",
      category: "censor_certificate",
      is_primary: true,
      created_at: new Date().toISOString(),
      upload: {
        id: "upload-censor",
        file_name: "censor.pdf",
        file_size: 1024,
        mime_type: "application/pdf",
        status: "ready",
        object_key: "censor.pdf",
        created_at: new Date().toISOString(),
      },
    },
    {
      id: "asset-ownership",
      title_id: "title-1",
      upload_id: "upload-ownership",
      category: "ownership_documents",
      is_primary: true,
      created_at: new Date().toISOString(),
      upload: {
        id: "upload-ownership",
        file_name: "rights.pdf",
        file_size: 1024,
        mime_type: "application/pdf",
        status: "ready",
        object_key: "rights.pdf",
        created_at: new Date().toISOString(),
      },
    },
  ];

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
      is_free: false,
      can_create_draft: true,
      can_submit: true,
      draft_count: 0,
      lifecycle_count: 0,
    });
    mockGetTitle.mockResolvedValue(existingTitle);
    mockListAssets.mockResolvedValue(trailerOnlyReadyAssets);
    mockEvaluateChecklist.mockReturnValue({
      hasTitle: true,
      hasSynopsis: true,
      hasFilm: false,
      hasTrailer: true,
      hasPoster: true,
      hasCensor: true,
      hasOwnership: true,
      censorRequired: true,
      ready: true,
      missing: [],
    });
    mockFetchReadiness.mockResolvedValue({
      ready: true,
      missing: [],
      has: {
        feature_film: false,
        trailer: true,
        poster: true,
        censor_certificate: true,
        ownership_documents: true,
      },
    });
    mockFetchTitleTimeline.mockResolvedValue([]);
    mockSubmitTitle.mockResolvedValue(undefined);
    mockSaveTitleMetadata.mockResolvedValue(undefined);
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });
  afterEach(cleanup);

  it("title card shows an Edit button when the title is not locked", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /^edit /i })).toBeInTheDocument();
  });

  it("clicking Edit opens TitleEditor for that title", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /^edit /i }));
    expect(await screen.findByTestId("title-editor")).toBeInTheDocument();
  });

  it("submits successfully with only a trailer attached and no main film", async () => {
    render(<MemoryRouter><MyTitlesSection /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /^edit /i }));
    await screen.findByTestId("title-editor");

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /submit for review/i })[0]).toBeEnabled();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /submit for review/i })[0]);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Submitted for review.");
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockSubmitTitle).toHaveBeenCalledWith("title-1");
  });
});
