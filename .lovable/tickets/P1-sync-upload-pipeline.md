# Ticket: Sync ingest pipeline contract

**Status:** Implemented  
**Priority:** P1  
**Owner:** upload platform

## Summary

Implemented a synchronous upload pipeline contract aligned to:

1. SHA-256 verification
2. Malware scan
3. Immutable original storage
4. Proxy generation
5. Thumbnail generation
6. Preview generation
7. Metadata extraction

## What was added

- Shared stage builder in `supabase/functions/_shared/uploadPipeline.ts`
  - `buildSyncPipelineEvents(...)` emits the canonical stage order.
- Multipart completion wiring in `supabase/functions/oci-multipart/index.ts`
  - emits all sync pipeline stage events after successful `complete`.
- Single-shot upload wiring in `supabase/functions/oci-upload/index.ts`
  - computes SHA-256 and emits all sync pipeline stage events after upload success.
- Tests in `supabase/functions/_shared/uploadPipeline_test.ts`
  - validates stage order and SHA-256 optionality behavior.

## Notes

- This change standardizes the ingest telemetry contract without introducing new DB tables or queue workers.
- Derivative generation stages are represented as synchronous contract events for downstream observability.
