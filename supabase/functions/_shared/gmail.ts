// Shared Gmail sender — routes through the Lovable connector gateway.
// Replaces the previous Resend-based transport. Uses the builder's connected
// Gmail account (gmail.send scope). Limits: ~500/day personal, ~2000/day Workspace.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(input: string): string {
  // Unicode-safe base64url encode for RFC 2822 raw message
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeHeader(value: string): string {
  // RFC 2047 encode any header that contains non-ASCII characters
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(value)))}?=`;
}

export interface GmailSendOptions {
  from: string;       // e.g. "StreamVista <you@yourdomain.com>"
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export interface GmailSendResult {
  ok: boolean;
  id?: string;
  threadId?: string;
  status: number;
  error?: string;
}

function toList(v?: string | string[]): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v.join(", ") : v;
}

export async function sendGmail(opts: GmailSendOptions): Promise<GmailSendResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!LOVABLE_API_KEY) return { ok: false, status: 500, error: "LOVABLE_API_KEY not configured" };
  if (!GOOGLE_MAIL_API_KEY) return { ok: false, status: 500, error: "GOOGLE_MAIL_API_KEY not configured (Gmail connector not linked)" };

  const to = toList(opts.to)!;
  const cc = toList(opts.cc);
  const bcc = toList(opts.bcc);

  const headers: string[] = [
    `From: ${opts.from}`,
    `To: ${to}`,
  ];
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (opts.replyTo) headers.push(`Reply-To: ${opts.replyTo}`);
  headers.push(`Subject: ${encodeHeader(opts.subject)}`);
  headers.push("MIME-Version: 1.0");

  let body: string;
  if (opts.html && opts.text) {
    const boundary = `bnd_${crypto.randomUUID().replace(/-/g, "")}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      opts.text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      opts.html,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  } else if (opts.html) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push("Content-Transfer-Encoding: 7bit");
    body = `\r\n${opts.html}`;
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push("Content-Transfer-Encoding: 7bit");
    body = `\r\n${opts.text ?? ""}`;
  }

  const raw = b64url(headers.join("\r\n") + body);

  try {
    const resp = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (out?.error?.message ?? out?.message ?? JSON.stringify(out)) || `Gmail send failed (${resp.status})`;
      return { ok: false, status: resp.status, error: String(msg) };
    }
    return { ok: true, status: resp.status, id: out?.id, threadId: out?.threadId };
  } catch (e) {
    return { ok: false, status: 500, error: (e as Error).message };
  }
}
