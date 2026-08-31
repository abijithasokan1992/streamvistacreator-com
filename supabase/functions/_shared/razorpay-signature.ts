/** Web Crypto HMAC-SHA256 helpers for Razorpay signatures (Deno Edge). */

export async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function signaturesEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Webhook: HMAC-SHA256(raw body) with RAZORPAY_WEBHOOK_SECRET */
export async function verifyWebhookSignature(
  rawBody: string,
  headerSig: string,
  webhookSecret: string,
): Promise<boolean> {
  if (!rawBody || !headerSig || !webhookSecret) return false;
  return signaturesEqual(await hmacHex(webhookSecret, rawBody), headerSig);
}

/** Checkout: HMAC-SHA256(order_id|payment_id) with RAZORPAY_KEY_SECRET */
export async function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  checkoutSig: string,
  keySecret: string,
): Promise<boolean> {
  if (!orderId || !paymentId || !checkoutSig || !keySecret) return false;
  return signaturesEqual(await hmacHex(keySecret, `${orderId}|${paymentId}`), checkoutSig);
}
