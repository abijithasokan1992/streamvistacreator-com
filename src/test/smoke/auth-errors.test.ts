import { describe, it, expect } from "vitest";
import { mapAuthError, isRetryableAuthError } from "@/lib/auth/authErrors";

describe("mapAuthError", () => {
  it("maps invalid credentials with a reset CTA", () => {
    const m = mapAuthError(new Error("Invalid login credentials"));
    expect(m.code).toBe("invalid_credentials");
    expect(m.action).toBe("reset");
  });

  it("maps unconfirmed email", () => {
    const m = mapAuthError({ message: "Email not confirmed" });
    expect(m.code).toBe("email_not_confirmed");
    expect(m.action).toBe("verify_email");
  });

  it("maps expired session", () => {
    const m = mapAuthError(new Error("JWT expired"));
    expect(m.code).toBe("session_expired");
    expect(m.action).toBe("sign_in");
  });

  it("maps suspended account to contact support", () => {
    const m = mapAuthError(new Error("User is_suspended"));
    expect(m.code).toBe("user_suspended");
    expect(m.action).toBe("contact_support");
  });

  it("maps missing role", () => {
    const m = mapAuthError(new Error("no role assigned"));
    expect(m.code).toBe("missing_role");
    expect(m.action).toBe("contact_support");
  });

  it("maps rate limits (status or message)", () => {
    expect(mapAuthError({ status: 429, message: "" }).code).toBe("rate_limited");
    expect(mapAuthError(new Error("over_email_send_rate_limit")).code).toBe("rate_limited");
  });

  it("maps network errors", () => {
    expect(mapAuthError(new Error("Failed to fetch")).code).toBe("network_error");
  });

  it("falls back to generic for unknown errors without leaking details", () => {
    const m = mapAuthError(new Error("weird internal xyz"));
    expect(m.code).toBe("generic");
    expect(m.message).not.toContain("weird");
  });

  it("marks only network/rate/invalid_link errors as retryable", () => {
    expect(isRetryableAuthError(new Error("Failed to fetch"))).toBe(true);
    expect(isRetryableAuthError({ status: 429 })).toBe(true);
    expect(isRetryableAuthError(new Error("Invalid login credentials"))).toBe(false);
  });

  it("maps expired/invalid magic or recovery link", () => {
    expect(mapAuthError(new Error("Email link is invalid or has expired")).code).toBe("invalid_link");
    expect(mapAuthError(new Error("otp_expired")).code).toBe("invalid_link");
    expect(mapAuthError(new Error("Token has been used")).code).toBe("invalid_link");
  });

  it("maps deleted user separately from suspended", () => {
    expect(mapAuthError(new Error("User not found")).code).toBe("user_deleted");
    expect(mapAuthError(new Error("user_banned")).code).toBe("user_suspended");
  });
});
