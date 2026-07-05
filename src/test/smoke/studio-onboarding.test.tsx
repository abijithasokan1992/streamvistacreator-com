/**
 * Smoke test — Studio onboarding gate + wizard workspace alignment.
 *
 * Guards the two regressions from the earlier fix:
 *   1. `isStudioOnboarded()` recognises a completed profile so the gate does
 *      not re-mount the wizard on refresh.
 *   2. The wizard imports `useWorkspaces` so its `orgId` matches the gate's
 *      `activeId` — no more silent multi-workspace fork.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isStudioOnboarded } from "@/components/studio/StudioProfileOnboardingGate";
import type { EntityProfile } from "@/hooks/useEntityProfile";

function baseProfile(overrides: Partial<EntityProfile> = {}): EntityProfile {
  return {
    id: "p1", kind: "studio", user_id: null, org_id: "ws1",
    legal_name: "Crayons Pictures LLP",
    display_name: "Crayons",
    entity_type: "llp",
    avatar_url: null,
    primary_email: "hello@crayons.example",
    primary_phone: "+91 9000000000",
    whatsapp: null,
    website: null,
    address_line1: null, address_line2: null,
    city: null, state: "Kerala", postal_code: null, country: "India",
    pan_number: "ABCDE1234F",
    gstin: null, tan_number: null, cin_number: null,
    is_gst_registered: false,
    place_of_supply_state: null,
    billing_legal_name: null, billing_email: null, billing_phone: null,
    billing_address_line1: null, billing_address_line2: null,
    billing_city: null, billing_state: null, billing_postal_code: null,
    billing_country: null, billing_notes: null,
    verification_status: "unverified",
    verification_notes: null,
    last_verified_at: null,
    profile_completion_pct: 100,
    created_at: "2026-07-01", updated_at: "2026-07-01",
    ...overrides,
  };
}

describe("Studio onboarding — regression guards", () => {
  it("isStudioOnboarded returns true for a completed profile", () => {
    expect(isStudioOnboarded(baseProfile())).toBe(true);
  });

  it("isStudioOnboarded returns false when PAN is missing (would re-show wizard)", () => {
    expect(isStudioOnboarded(baseProfile({ pan_number: null }))).toBe(false);
  });

  it("isStudioOnboarded requires GSTIN when GST-registered", () => {
    expect(isStudioOnboarded(baseProfile({
      is_gst_registered: true, gstin: null, place_of_supply_state: "Kerala",
    }))).toBe(false);
    expect(isStudioOnboarded(baseProfile({
      is_gst_registered: true, gstin: "32ABCDE1234F1Z5", place_of_supply_state: "Kerala",
    }))).toBe(true);
  });

  it("wizard imports useWorkspaces so its orgId aligns with the gate", () => {
    // Structural guard: if someone re-forks the workspace source in the
    // wizard, this test fails before it can reach production.
    const wizard = readFileSync(
      resolve(__dirname, "../../components/studio/StudioOnboardingWizard.tsx"),
      "utf8",
    );
    expect(wizard).toMatch(/from "@\/hooks\/useWorkspaces"/);
    expect(wizard).toMatch(/useWorkspaces\(\)/);
  });
});
