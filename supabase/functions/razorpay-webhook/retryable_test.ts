import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isRetryableWebhookProcessingError } from "./retryable.ts";

Deno.test("isRetryableWebhookProcessingError marks explicit permanent errors as non-retryable", () => {
  assertEquals(isRetryableWebhookProcessingError("[PERMANENT] validation failed"), false);
  assertEquals(isRetryableWebhookProcessingError("permission denied for relation billing_orders"), false);
});

Deno.test("isRetryableWebhookProcessingError marks transient dependency failures as retryable", () => {
  assertEquals(isRetryableWebhookProcessingError("database connection timeout"), true);
  assertEquals(isRetryableWebhookProcessingError("HTTP 503 upstream unavailable"), true);
});

Deno.test("isRetryableWebhookProcessingError defaults unknown errors to retryable", () => {
  assertEquals(isRetryableWebhookProcessingError("unexpected webhook processing error"), true);
});
