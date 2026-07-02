import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSyncPipelineEvents } from "./uploadPipeline.ts";

Deno.test("sync upload pipeline emits expected stage order", () => {
  const events = buildSyncPipelineEvents({ fileSha256: "abc123" });
  assertEquals(
    events.map((e) => e.event),
    [
      "pipeline.sha256_verified",
      "pipeline.malware_scanned",
      "pipeline.original_stored_immutable",
      "pipeline.proxy_generated",
      "pipeline.thumbnail_generated",
      "pipeline.preview_generated",
      "pipeline.metadata_extracted",
    ],
  );
  assertEquals(events[0].metadata.digest, "abc123");
  assertEquals(events[0].metadata.digest_present, true);
});

Deno.test("sync upload pipeline works without digest", () => {
  const events = buildSyncPipelineEvents();
  assertEquals(events[0].metadata.digest, null);
  assertEquals(events[0].metadata.digest_present, false);
  assertEquals(events[1].metadata.result, "clean");
});
