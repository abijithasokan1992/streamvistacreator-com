import { describe, expect, it } from "vitest";
import {
  STREAMVISTA_LIFECYCLE_EVENT_CHAIN,
  sanitizeAnalyticsProperties,
} from "@/lib/analytics/amplitude";

describe("StreamVista Amplitude lifecycle taxonomy", () => {
  it("keeps the canonical commercial lifecycle in order", () => {
    expect(STREAMVISTA_LIFECYCLE_EVENT_CHAIN).toEqual([
      "Creator Acquired",
      "Content Submitted",
      "Rights Completed",
      "QC Passed",
      "Buyer Ready",
      "Buyer Interest",
      "Deal Created",
      "Contract Executed",
      "Delivery Completed",
      "Revenue Recorded",
      "Settlement Completed",
    ]);
  });

  it("allows business dimensions but strips private form/legal fields", () => {
    const sanitized = sanitizeAnalyticsProperties({
      persona: "creator",
      content_type: "Feature Film",
      source: "public_content_submission",
      campaign: "founder-outreach",
      deal_value: 125000,
      currency: "INR",
      authenticated: true,
      email: "private@example.com",
      contact_number: "+91-0000000000",
      rights_owner: "Private Person",
      contract_text: "private contract text",
      bank_information: "private bank info",
      title: "Unreleased title",
    });

    expect(sanitized).toEqual({
      persona: "creator",
      content_type: "Feature Film",
      source: "public_content_submission",
      campaign: "founder-outreach",
      deal_value: 125000,
      currency: "INR",
      authenticated: true,
    });
  });
});
