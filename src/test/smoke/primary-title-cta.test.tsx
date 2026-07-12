import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PrimaryTitleCTA } from "@/components/creator/titles/PrimaryTitleCTA";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

const maybeSingle = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: () => maybeSingle() }),
          }),
        }),
      }),
    }),
  },
}));

function wrap(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("PrimaryTitleCTA", () => {
  it("shows Create for no title", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null });
    wrap(<PrimaryTitleCTA />);
    expect(await screen.findByText(/Create Your First Title/i)).toBeTruthy();
  });
  it("shows Continue for draft", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "t1", status: "draft" } });
    wrap(<PrimaryTitleCTA />);
    expect(await screen.findByText(/Continue Your Title/i)).toBeTruthy();
  });
  it("shows Review & Submit for approved", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "t1", status: "approved" } });
    wrap(<PrimaryTitleCTA />);
    expect(await screen.findByText(/Review & Submit/i)).toBeTruthy();
  });
  it("shows Track Review for in_review", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "t1", status: "in_review" } });
    wrap(<PrimaryTitleCTA />);
    expect(await screen.findByText(/Track Review/i)).toBeTruthy();
  });
});
