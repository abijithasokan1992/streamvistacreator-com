import { describe, it, expect } from "vitest";
import { safeNextPath, readSafeNext } from "@/lib/auth/safeNext";

describe("safeNextPath", () => {
  it("accepts a same-origin relative path", () => {
    expect(safeNextPath("/dashboard/content")).toBe("/dashboard/content");
    expect(safeNextPath("/dashboard/content?tab=drafts")).toBe("/dashboard/content?tab=drafts");
  });

  it("rejects protocol-relative URLs (open redirect)", () => {
    expect(safeNextPath("//evil.example.com")).toBeNull();
  });

  it("rejects absolute http/https URLs", () => {
    expect(safeNextPath("https://evil.example.com/steal")).toBeNull();
    expect(safeNextPath("http://evil")).toBeNull();
  });

  it("rejects javascript: and data: schemes", () => {
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("data:text/html,<script>")).toBeNull();
  });

  it("rejects backslash tricks", () => {
    expect(safeNextPath("/\\evil.example.com")).toBeNull();
  });

  it("rejects null/empty/non-string input", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    // @ts-expect-error runtime guard
    expect(safeNextPath(42)).toBeNull();
  });

  it("rejects loop targets back into auth surfaces", () => {
    expect(safeNextPath("/auth")).toBeNull();
    expect(safeNextPath("/auth/callback")).toBeNull();
    expect(safeNextPath("/auth?next=/dashboard")).toBeNull();
    expect(safeNextPath("/reset-password")).toBeNull();
  });

  it("caps ridiculously long input", () => {
    expect(safeNextPath("/" + "a".repeat(600))).toBeNull();
  });

  it("readSafeNext parses from a query string", () => {
    expect(readSafeNext("?next=/dashboard/buyer")).toBe("/dashboard/buyer");
    expect(readSafeNext("?next=//evil")).toBeNull();
    expect(readSafeNext("")).toBeNull();
    expect(readSafeNext(null)).toBeNull();
  });
});
