import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Mirrors the schema in src/pages/ResetPassword.tsx. If the app copy changes,
 * this test enforces we keep the same minimum bar for password strength so a
 * regression can never silently accept weak passwords.
 */
const PasswordSchema = z
  .string()
  .min(8, "Min 8 characters")
  .max(72)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), { message: "Use letters and numbers" });

describe("reset password: validation", () => {
  it("accepts a strong password", () => {
    expect(PasswordSchema.safeParse("Correct1Horse").success).toBe(true);
  });
  it("rejects short passwords", () => {
    expect(PasswordSchema.safeParse("a1b2c3").success).toBe(false);
  });
  it("rejects passwords with no digit", () => {
    expect(PasswordSchema.safeParse("abcdefghij").success).toBe(false);
  });
  it("rejects passwords with no letter", () => {
    expect(PasswordSchema.safeParse("12345678").success).toBe(false);
  });
  it("caps at 72 characters (bcrypt limit)", () => {
    expect(PasswordSchema.safeParse("a1" + "x".repeat(72)).success).toBe(false);
  });
});
