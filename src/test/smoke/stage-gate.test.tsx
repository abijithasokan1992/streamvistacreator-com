import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageGate } from "@/components/shared/StageGate";

const roleRef = { current: "creator" as any };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: roleRef.current }),
}));

describe("StageGate", () => {
  it("hides content when role not allowed", () => {
    roleRef.current = "creator";
    render(
      <StageGate allowRoles={["studio","admin"]} label="X">
        <div>SECRET</div>
      </StageGate>,
    );
    expect(screen.queryByText("SECRET")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("X");
  });

  it("shows content when role allowed", () => {
    roleRef.current = "studio";
    render(
      <StageGate allowRoles={["studio","admin"]}>
        <div>SECRET</div>
      </StageGate>,
    );
    expect(screen.getByText("SECRET")).toBeTruthy();
  });

  it("hides on plan mismatch even if role allowed", () => {
    roleRef.current = "studio";
    render(
      <StageGate allowRoles={["studio"]} allowPlans={["creator_paid"]} planCode="creator_basic">
        <div>SECRET</div>
      </StageGate>,
    );
    expect(screen.queryByText("SECRET")).toBeNull();
  });

  it("hides on status below minStatus", () => {
    roleRef.current = "studio";
    render(
      <StageGate allowRoles={["studio"]} minStatus="approved" titleStatus="draft">
        <div>SECRET</div>
      </StageGate>,
    );
    expect(screen.queryByText("SECRET")).toBeNull();
  });

  it("admin bypasses all checks", () => {
    roleRef.current = "admin";
    render(
      <StageGate allowRoles={["studio"]} allowPlans={["x"]} planCode="y" minStatus="published" titleStatus="draft">
        <div>SECRET</div>
      </StageGate>,
    );
    expect(screen.getByText("SECRET")).toBeTruthy();
  });
});
