/**
 * Smoke test: the "From upload to revenue" Workflow section
 * MUST be present in the rendered DOM for every public homepage route,
 * at every common viewport size we ship for.
 *
 * If this test fails, the section was either unmounted, renamed, or
 * lost its `#workflow` anchor — all of which break anchor links,
 * SEO deep-links, and the cross-device QA harness.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// Keep the home page render hermetic — no Supabase, no network.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, role: null, loading: false }),
  dashboardForRole: () => "/",
}));

// Avoid hitting any client-side analytics/observers from child components.
vi.mock("@/integrations/supabase/client", () => {
  // Fully chainable query builder that resolves to an empty result for any call.
  const makeBuilder = () => {
    const result = Promise.resolve({ data: [], error: null, count: 0 });
    const builder: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        result.then(resolve, reject),
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
    };
    const passthrough = new Proxy(builder, {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string];
        // Any unknown method (.eq, .select, .order, .limit, .in, .gte, .lte, ...) returns the builder.
        return () => passthrough;
      },
    });
    return passthrough;
  };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: () => makeBuilder(),
      rpc: () => makeBuilder(),
      channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe() {} }) }) }),
      removeChannel: () => {},
      functions: { invoke: async () => ({ data: null, error: null }) },
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
    },
  };
});

import Index from "@/pages/Index";

/** Public homepage routes that MUST render the Workflow section. */
const HOMEPAGE_ROUTES: Array<{ path: string; element: React.ReactNode }> = [
  { path: "/", element: <Index /> },
];

/** Common viewport widths we ship for (mobile → desktop). */
const VIEWPORTS = [320, 375, 390, 412, 768, 820, 1024, 1280, 1440, 1920];

function setViewport(width: number, height = 900) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

function renderRoute(path: string, element: React.ReactNode) {
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

describe("Workflow section presence", () => {
  beforeEach(() => setViewport(1280));
  afterEach(() => cleanup());

  for (const { path, element } of HOMEPAGE_ROUTES) {
    for (const width of VIEWPORTS) {
      it(`renders #workflow on ${path} @ ${width}px`, () => {
        setViewport(width);
        const { container } = renderRoute(path, element);

        const section = container.querySelector("#workflow");
        expect(
          section,
          `Expected the Workflow section (#workflow) to be in the DOM on ${path} at ${width}px viewport. ` +
            `If the section was intentionally removed, update HOMEPAGE_ROUTES in this test.`,
        ).not.toBeNull();

        // The section must contain the current workflow copy,
        // not just an empty anchor placeholder.
        const text = section?.textContent ?? "";
        expect(text, "Workflow section should mention 'From upload to revenue'").toMatch(
          /from upload to revenue/i,
        );

        // All 5 current workflow stages must be present.
        for (const stage of ["Upload", "Review", "Marketplace", "Buyer", "Revenue"]) {
          expect(text, `Workflow section should mention stage '${stage}'`).toContain(stage);
        }
      });
    }
  }
});
