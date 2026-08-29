import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signaturesEqual(a: string, b: string): boolean {
  try {
    const x = Buffer.from(a, "utf8");
    const y = Buffer.from(b, "utf8");
    return x.length === y.length && timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

/** Webhook: HMAC-SHA256(raw body) with RAZORPAY_WEBHOOK_SECRET */
export function verifyWebhookSignature(
  rawBody: string,
  headerSig: string,
  webhookSecret: string,
): boolean {
  if (!rawBody || !headerSig || !webhookSecret) return false;
  return signaturesEqual(hmacHex(webhookSecret, rawBody), headerSig);
}

/** Checkout: HMAC-SHA256(order_id|payment_id) with RAZORPAY_KEY_SECRET */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  checkoutSig: string,
  keySecret: string,
): boolean {
  if (!orderId || !paymentId || !checkoutSig || !keySecret) return false;
  return signaturesEqual(hmacHex(keySecret, `${orderId}|${paymentId}`), checkoutSig);
}
