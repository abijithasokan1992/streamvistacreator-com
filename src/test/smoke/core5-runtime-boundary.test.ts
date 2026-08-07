import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
const collegeErpSource = readFileSync(new URL("../../pages/CollegeERP.tsx", import.meta.url), "utf8");

describe("StreamVista Core 5 runtime boundary", () => {
  it("keeps the canonical Website, Creator, Buyer and Admin entry surfaces", () => {
    expect(appSource).toContain('path="/"');
    expect(appSource).toContain('path="/creator"');
    expect(appSource).toContain('path="/dashboard/buyer"');
    expect(appSource).toContain('path: "/admin"');
  });

  it("does not render the legacy College ERP application inside StreamVista", () => {
    expect(collegeErpSource).toContain('<Navigate to="/" replace />');
    expect(collegeErpSource).not.toContain("Apex University");
    expect(collegeErpSource).not.toContain("Razorpay Gateway");
    expect(collegeErpSource).not.toContain("Mock database");
  });
});
