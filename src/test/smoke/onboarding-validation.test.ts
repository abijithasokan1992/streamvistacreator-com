import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Integration tests for the onboarding API request validator.
 *
 * The onboarding endpoint accepts a payload with:
 *   - clientName            (required, 2–200 chars, trimmed)
 *   - professionalRole      (required, must be one of the allowed roles)
 *   - businessEmail         (required, valid email, ≤255 chars)
 *   - whatsappContact       (required, E.164-ish: optional leading '+',
 *                            8–15 digits, no letters/symbols)
 *   - accessAuthorizationCode (required, 6–32 chars, alphanumeric + dashes,
 *                              uppercase only)
 *
 * These tests replay the validator directly (the same shape used server-side
 * in `submit-onboarding` and client-side in `OnboardingForm`) and assert that
 * missing or malformed fields are rejected with a descriptive error and that
 * a well-formed payload passes.
 */

const ALLOWED_ROLES = [
  "Creator",
  "Editor",
  "Director",
  "Cinematographer",
  "Production Studio",
  "Production House",
  "Post-Production Team",
  "VFX Facility",
  "Independent Filmmaker",
  "Other",
] as const;

export const OnboardingRequestSchema = z.object({
  clientName: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be at most 200 characters"),
  professionalRole: z
    .enum(ALLOWED_ROLES, {
      required_error: "Professional role is required",
      invalid_type_error: "Professional role is invalid",
    }),
  businessEmail: z
    .string({ required_error: "Business email is required" })
    .trim()
    .email("Business email is invalid")
    .max(255, "Business email must be at most 255 characters"),
  whatsappContact: z
    .string({ required_error: "WhatsApp contact is required" })
    .trim()
    .regex(
      /^\+?[0-9]{8,15}$/,
      "WhatsApp contact must be 8–15 digits, optionally prefixed with '+'",
    ),
  accessAuthorizationCode: z
    .string({ required_error: "Access authorization code is required" })
    .trim()
    .regex(
      /^[A-Z0-9-]{6,32}$/,
      "Access authorization code must be 6–32 uppercase alphanumeric characters",
    ),
});

export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;

/** Mirrors how the edge function would respond to a bad request. */
function validateOnboardingPayload(payload: unknown):
  | { ok: true; data: OnboardingRequest }
  | { ok: false; status: 400; errors: Record<string, string> } {
  const parsed = OnboardingRequestSchema.safeParse(payload);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, status: 400, errors };
}

const validPayload: OnboardingRequest = {
  clientName: "Crayons Pictures",
  professionalRole: "Production Studio",
  businessEmail: "hello@crayons.test",
  whatsappContact: "+919812345678",
  accessAuthorizationCode: "INDUSTRY-2026",
};

describe("onboarding API request validator", () => {
  it("accepts a fully-formed payload", () => {
    const result = validateOnboardingPayload(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clientName).toBe("Crayons Pictures");
      expect(result.data.accessAuthorizationCode).toBe("INDUSTRY-2026");
    }
  });

  describe("clientName", () => {
    it("rejects a missing name", () => {
      const { clientName: _drop, ...rest } = validPayload;
      const result = validateOnboardingPayload(rest);
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.status).toBe(400);
        expect(result.errors.clientName).toMatch(/name/i);
      }
    });

    it("rejects an empty / whitespace-only name", () => {
      const result = validateOnboardingPayload({ ...validPayload, clientName: "   " });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.clientName).toMatch(/at least 2/i);
    });

    it("rejects a non-string name", () => {
      const result = validateOnboardingPayload({ ...validPayload, clientName: 42 });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.clientName).toBeDefined();
    });

    it("rejects an overlong name (>200 chars)", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        clientName: "a".repeat(201),
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.clientName).toMatch(/at most 200/i);
    });
  });

  describe("professionalRole", () => {
    it("rejects a missing role", () => {
      const { professionalRole: _drop, ...rest } = validPayload;
      const result = validateOnboardingPayload(rest);
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.professionalRole).toBeDefined();
    });

    it("rejects a role not in the allow-list", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        professionalRole: "Astronaut",
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.professionalRole).toBeDefined();
    });

    it("rejects an empty-string role", () => {
      const result = validateOnboardingPayload({ ...validPayload, professionalRole: "" });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.professionalRole).toBeDefined();
    });
  });

  describe("whatsappContact", () => {
    it("rejects a missing WhatsApp contact", () => {
      const { whatsappContact: _drop, ...rest } = validPayload;
      const result = validateOnboardingPayload(rest);
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.whatsappContact).toMatch(/whatsapp/i);
    });

    it("rejects a WhatsApp contact with letters", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        whatsappContact: "+91-call-me",
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.whatsappContact).toMatch(/digits/i);
    });

    it("rejects a WhatsApp contact that is too short", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        whatsappContact: "12345",
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.whatsappContact).toBeDefined();
    });

    it("rejects a WhatsApp contact that is too long", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        whatsappContact: "+1234567890123456", // 16 digits
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.whatsappContact).toBeDefined();
    });

    it("accepts a bare digits-only WhatsApp contact", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        whatsappContact: "919812345678",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("accessAuthorizationCode", () => {
    it("rejects a missing access authorization code", () => {
      const { accessAuthorizationCode: _drop, ...rest } = validPayload;
      const result = validateOnboardingPayload(rest);
      expect(result.ok).toBe(false);
      if (result.ok === false)
        expect(result.errors.accessAuthorizationCode).toMatch(/access authorization/i);
    });

    it("rejects a lowercase access authorization code", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        accessAuthorizationCode: "industry-2026",
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.accessAuthorizationCode).toBeDefined();
    });

    it("rejects an access authorization code with disallowed symbols", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        accessAuthorizationCode: "INDUSTRY 2026!",
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.accessAuthorizationCode).toBeDefined();
    });

    it("rejects an access authorization code that is too short (<6 chars)", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        accessAuthorizationCode: "AB1",
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.accessAuthorizationCode).toBeDefined();
    });

    it("rejects an access authorization code that is too long (>32 chars)", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        accessAuthorizationCode: "A".repeat(33),
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.accessAuthorizationCode).toBeDefined();
    });
  });

  describe("email (baseline)", () => {
    it("rejects a malformed email", () => {
      const result = validateOnboardingPayload({
        ...validPayload,
        businessEmail: "not-an-email",
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.errors.businessEmail).toMatch(/invalid/i);
    });
  });

  it("returns all four field errors when every required field is missing", () => {
    const result = validateOnboardingPayload({});
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.status).toBe(400);
      expect(result.errors.clientName).toBeDefined();
      expect(result.errors.professionalRole).toBeDefined();
      expect(result.errors.whatsappContact).toBeDefined();
      expect(result.errors.accessAuthorizationCode).toBeDefined();
    }
  });
});
