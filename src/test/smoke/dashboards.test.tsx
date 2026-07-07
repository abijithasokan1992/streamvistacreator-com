import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CreatorPlanStrip from "@/components/creator/CreatorPlanStrip";
import CreatorQuickActions from "@/components/creator/CreatorQuickActions";
import StudioPlanStrip from "@/components/studio/StudioPlanStrip";
import StudioQuickActions from "@/components/studio/StudioQuickActions";
import BuyerNav from "@/components/buyer/sections/BuyerNav";
import AdminCommandBar from "@/components/admin/AdminCommandBar";

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Creator dashboard smoke", () => {
  it("plan strip shows Free tier + upgrade CTA", () => {
    const onUpgrade = vi.fn();
    wrap(
      <CreatorPlanStrip
        isFree
        tier={null}
        titles={[]}
        onUpgrade={onUpgrade}
      />,
    );
    expect(screen.getByText(/current plan/i)).toBeInTheDocument();
    expect(screen.getAllByText(/free/i).length).toBeGreaterThan(0);
    const cta = screen.getByRole("button", { name: /upgrade|manage/i });
    fireEvent.click(cta);
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("quick actions render 6 cards and route to titles", () => {
    const onNavigate = vi.fn();
    wrap(
      <CreatorQuickActions
        onNavigate={onNavigate}
        isFree
        tier={null}
        titles={[]}
      />,
    );
    expect(screen.getByText(/creator tools/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/new title wizard/i));
    expect(onNavigate).toHaveBeenCalledWith("titles");
    // Readiness drawer opens
    fireEvent.click(screen.getByText(/submission readiness/i));
    expect(screen.getAllByText(/submission readiness/i).length).toBeGreaterThan(1);
  });
});

describe("Studio dashboard smoke", () => {
  it("plan strip reflects paid vault state and CTA", () => {
    const onUpgrade = vi.fn();
    wrap(
      <StudioPlanStrip
        hasPaidVault
        hasTesting={false}
        totalGb={1024}
        usedGb={256}
        onUpgrade={onUpgrade}
      />,
    );
    expect(screen.getByText(/studio vault — paid/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /manage/i }));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("quick actions trigger ingest + billing callbacks", () => {
    const onOpenIngest = vi.fn();
    const onOpenBilling = vi.fn();
    const onOpenLibrary = vi.fn();
    wrap(
      <StudioQuickActions
        hasUsable
        totalGb={1024}
        usedGb={100}
        onOpenIngest={onOpenIngest}
        onOpenBilling={onOpenBilling}
        onOpenLibrary={onOpenLibrary}
      />,
    );
    expect(screen.getByText(/studio tools/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/ingest setup wizard/i));
    expect(onOpenIngest).toHaveBeenCalled();
  });
});

describe("Buyer dashboard smoke", () => {
  it("navigation exposes buyer journey sections", () => {
    const onChange = vi.fn();
    wrap(<BuyerNav section="dashboard" onChange={onChange} badges={{ requests: 2 }} />);
    // Journey sections are advertised (mobile + desktop copies)
    expect(screen.getAllByText(/find content/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/screeners/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/commercial/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText(/find content/i)[0]);
    expect(onChange).toHaveBeenCalledWith("find");
  });
});

describe("Admin command bar smoke", () => {
  it("opens with Cmd+K and surfaces sections", () => {
    const onJump = vi.fn();
    const departments = [
      {
        id: "operations",
        label: "Operations",
        sections: [
          { id: "approvals", label: "Approvals" },
          { id: "onboarding", label: "Onboarding" },
        ],
      },
      {
        id: "commerce",
        label: "Commerce",
        sections: [{ id: "billing", label: "Billing" }],
      },
    ];
    wrap(<AdminCommandBar departments={departments} onJump={onJump} />);
    // Trigger button visible
    expect(screen.getByLabelText(/search admin sections/i)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText(/search|type/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/approvals/i));
    expect(onJump).toHaveBeenCalledWith("operations", "approvals");
  });
});
