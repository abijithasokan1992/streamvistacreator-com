/**
 * Smoke test: the current Creator workflow section MUST remain present in the
 * rendered DOM at every common viewport size we ship for.
 *
 * The `#workflow` anchor is a stable deep-link/QA contract; the copy below
 * reflects the current three-part readiness path rather than the retired
 * five-stage marketing pipeline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, role: null, loading: false }),
  dashboardForRole: () => "/",
}));

vi.mock("@/integrations/supabase/client", () => {
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

const HOMEPAGE_ROUTES: Array<{ path: string; element: React.ReactNode }> = [
  { path: "/", element: <Index /> },
];

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
          `Expected the Creator workflow section (#workflow) to be in the DOM on ${path} at ${width}px viewport.`,
        ).not.toBeNull();

        const text = section?.textContent ?? "";
        expect(text).toMatch(/creator workflow/i);
        expect(text).toMatch(/one clear path from title to readiness/i);

        for (const stage of ["Upload & Organize", "Rights & Readiness", "Buyer & Delivery"]) {
          expect(text, `Workflow section should mention stage '${stage}'`).toContain(stage);
        }
      });
    }
  }
});
