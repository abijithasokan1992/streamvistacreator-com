// Unit tests for the shared upload-type validation contract used by both
// `oci-upload` (single-shot) and `oci-multipart` (init).
//
// These tests pin the server-side allowlist behaviour so that any future
// loosening of the policy is intentional and reviewed.

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateUploadKind } from "./uploadValidation.ts";

// -------- Forbidden extensions --------

Deno.test("forbidden extension: .exe is rejected with passthrough message", () => {
  const r = validateUploadKind({ fileName: "malware.EXE", mimeType: "application/octet-stream" });
  assertExists(r);
  assertEquals(r!.code, "forbidden_file_type");
  assertStringIncludes(r!.message, ".exe");
  assertStringIncludes(r!.message, "Upload Not Allowed");
});

Deno.test("forbidden extension: .sh is rejected", () => {
  const r = validateUploadKind({ fileName: "deploy.sh", mimeType: "text/plain" });
  assertExists(r);
  assertEquals(r!.code, "forbidden_file_type");
});

Deno.test("forbidden extension: .php is rejected", () => {
  const r = validateUploadKind({ fileName: "shell.php", mimeType: "application/octet-stream" });
  assertExists(r);
  assertEquals(r!.code, "forbidden_file_type");
});

Deno.test("forbidden extension: .html is rejected", () => {
  const r = validateUploadKind({ fileName: "index.html", mimeType: "text/plain" });
  assertExists(r);
  assertEquals(r!.code, "forbidden_file_type");
});

Deno.test("forbidden extension: .svg is rejected (XSS vector)", () => {
  const r = validateUploadKind({ fileName: "logo.svg", mimeType: "application/octet-stream" });
  assertExists(r);
  assertEquals(r!.code, "forbidden_file_type");
});

Deno.test("forbidden extension: .apk is rejected", () => {
  const r = validateUploadKind({ fileName: "app.apk", mimeType: "application/octet-stream" });
  assertExists(r);
});

// -------- Forbidden MIME types (extension might look safe) --------

Deno.test("forbidden MIME: text/html surfaces in error message", () => {
  const r = validateUploadKind({ fileName: "report.bin", mimeType: "text/html" });
  assertExists(r);
  assertEquals(r!.code, "forbidden_file_type");
  assertStringIncludes(r!.message, "text/html");
});

Deno.test("forbidden MIME: image/svg+xml is rejected even with .png name", () => {
  const r = validateUploadKind({ fileName: "tricky.png", mimeType: "image/svg+xml" });
  assertExists(r);
  assertEquals(r!.code, "forbidden_file_type");
  assertStringIncludes(r!.message, "image/svg+xml");
});

Deno.test("forbidden MIME: application/x-msdownload is rejected", () => {
  const r = validateUploadKind({ fileName: "installer.bin", mimeType: "application/x-msdownload" });
  assertExists(r);
});

Deno.test("forbidden MIME: charset parameter is tolerated", () => {
  const r = validateUploadKind({ fileName: "x.bin", mimeType: "text/html;charset=utf-8" });
  assertExists(r);
  assertEquals(r!.code, "forbidden_file_type");
});

// -------- Category / family mismatches --------

Deno.test("category mismatch: trailer (video) rejects image/jpeg with passthrough mime + category", () => {
  const r = validateUploadKind({
    fileName: "art.jpg", mimeType: "image/jpeg", category: "trailer",
  });
  assertExists(r);
  assertEquals(r!.code, "category_mime_mismatch");
  assertStringIncludes(r!.message, "image/jpeg");
  assertStringIncludes(r!.message, "trailer");
});

Deno.test("category mismatch: poster (image) rejects video/mp4", () => {
  const r = validateUploadKind({
    fileName: "movie.mp4", mimeType: "video/mp4", category: "poster",
  });
  assertExists(r);
  assertEquals(r!.code, "category_mime_mismatch");
});

Deno.test("category mismatch: subtitle rejects video", () => {
  const r = validateUploadKind({
    fileName: "captions.mp4", mimeType: "video/mp4", category: "captions",
  });
  assertExists(r);
  assertEquals(r!.code, "category_mime_mismatch");
});

// -------- Allowed paths --------

Deno.test("allowed: trailer + video/mp4", () => {
  assertEquals(validateUploadKind({ fileName: "x.mp4", mimeType: "video/mp4", category: "trailer" }), null);
});

Deno.test("allowed: poster + image/png", () => {
  assertEquals(validateUploadKind({ fileName: "p.png", mimeType: "image/png", category: "poster" }), null);
});

Deno.test("allowed: subtitle + text/vtt", () => {
  assertEquals(validateUploadKind({ fileName: "cap.vtt", mimeType: "text/vtt", category: "subtitle" }), null);
});

Deno.test("allowed: octet-stream tolerated when category set (browser drops MIME)", () => {
  assertEquals(
    validateUploadKind({ fileName: "x.mov", mimeType: "application/octet-stream", category: "trailer" }),
    null,
  );
});

Deno.test("allowed: unknown category is permissive (only forbidden list applies)", () => {
  assertEquals(
    validateUploadKind({ fileName: "data.json", mimeType: "application/json", category: "weird-bucket" }),
    null,
  );
});

Deno.test("allowed: no category, plain pdf", () => {
  assertEquals(validateUploadKind({ fileName: "doc.pdf", mimeType: "application/pdf" }), null);
});

Deno.test("allowed: censor_certificate + image/jpeg (scanned doc)", () => {
  assertEquals(
    validateUploadKind({ fileName: "cert.jpg", mimeType: "image/jpeg", category: "censor_certificate" }),
    null,
  );
});

// -------- Edge cases --------

Deno.test("edge: empty filename + empty mime is allowed (no category)", () => {
  assertEquals(validateUploadKind({ fileName: "", mimeType: "" }), null);
});

Deno.test("edge: file with no extension and forbidden mime still rejected", () => {
  const r = validateUploadKind({ fileName: "noext", mimeType: "application/x-sh" });
  assertExists(r);
});

Deno.test("edge: category casing/symbols normalised", () => {
  assertEquals(
    validateUploadKind({ fileName: "x.mp4", mimeType: "video/mp4", category: "  Trailer!! " }),
    null,
  );
});
