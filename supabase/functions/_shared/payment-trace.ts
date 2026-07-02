// Forensic payment trace writer.
// All edge functions involved in a Razorpay flow should call `recordTrace`
// at each meaningful step. Failures are swallowed so tracing never blocks
// the payment path.

export async function recordTrace(
  admin: any,
  orderId: string | null | undefined,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!orderId) return;
  try {
    await admin.rpc("payment_trace_upsert", {
      p_order_id: orderId,
      p_patch: patch as unknown as Record<string, unknown>,
    });
  } catch (e) {
    console.error("payment_trace_upsert failed", e);
  }
}

export const nowIso = () => new Date().toISOString();
