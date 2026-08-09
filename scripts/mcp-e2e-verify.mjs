#!/usr/bin/env node
/**
 * MCP Authenticated E2E Verifier — StreamVista
 *
 * Runs the required sequence against the deployed MCP endpoint:
 *   1. initialize
 *   2. notifications/initialized
 *   3. tools/list
 *   4. tools/call → whoami
 *   5. tools/call → creator_my_workspace
 *   6. tools/call → list_productions   (Studio-only; probes cross-role isolation)
 *
 * REQUIREMENTS
 *   - The endpoint must be called with a real signed-in user's OAuth bearer
 *     token (an MCP-issued token, obtained via the OAuth flow). Never use the
 *     Supabase anon key. Never print the token.
 *   - Provide MCP_URL explicitly. There is intentionally no provider/project
 *     fallback, so a stale production endpoint can never be tested by accident.
 *   - Provide the token via env: MCP_ACCESS_TOKEN=... node scripts/mcp-e2e-verify.mjs
 *   - Optional: EXPECTED_EMAIL to assert whoami identity match.
 *
 * SAFETY
 *   - Read-only: only tool calls issued are whoami, creator_my_workspace, and
 *     list_productions (a Studio-only *read*).
 *   - The bearer token is read from the environment and forwarded to the
 *     endpoint only. It is never echoed, logged, or included in the report.
 */

const ENDPOINT = process.env.MCP_URL?.trim();
const TOKEN = process.env.MCP_ACCESS_TOKEN;
const EXPECTED_EMAIL = process.env.EXPECTED_EMAIL ?? null;

if (!ENDPOINT) {
  console.error(JSON.stringify({
    error: "MCP_URL env var is required. Refusing to use an implicit or stale MCP endpoint.",
  }, null, 2));
  process.exit(2);
}

if (!TOKEN) {
  console.error(JSON.stringify({
    error: "MCP_ACCESS_TOKEN env var is required (real OAuth user token, not the anon key).",
  }, null, 2));
  process.exit(2);
}

function mask(value) {
  if (value == null) return value;
  if (typeof value !== "string") return value;
  if (value.includes("@")) {
    const [u, d] = value.split("@");
    const head = u.slice(0, 1);
    const tail = u.slice(-1);
    return `${head}***${tail}@${d}`;
  }
  if (/^[0-9a-f-]{8,}$/i.test(value)) {
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
  }
  return value;
}

function maskDeep(input, keyHint = "") {
  if (Array.isArray(input)) return input.map((v) => maskDeep(v));
  if (input && typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) out[k] = maskDeep(v, k);
    return out;
  }
  const sensitiveKey = /(^|_)(id|user_id|workspace_id|email|owner|actor)$/i.test(keyHint);
  return sensitiveKey ? mask(input) : input;
}

let sessionId = null;

async function rpc(method, params, { notification = false } = {}) {
  const body = notification
    ? { jsonrpc: "2.0", method, params }
    : { jsonrpc: "2.0", id: crypto.randomUUID(), method, params };

  const headers = {
    "content-type": "application/json",
    "accept": "application/json, text/event-stream",
    authorization: `Bearer ${TOKEN}`,
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const sid = res.headers.get("mcp-session-id");
  if (sid && !sessionId) sessionId = sid;

  const text = await res.text();
  if (notification) return { status: res.status, raw: text };

  let json = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload && payload !== "[DONE]") { json = JSON.parse(payload); break; }
      }
    }
  } else {
    try { json = JSON.parse(text); } catch { /* leave null */ }
  }
  return { status: res.status, json, raw: text };
}

function parseToolResult(rpcJson) {
  const r = rpcJson?.result;
  if (!r) return { error: rpcJson?.error ?? "no result" };
  const textPart = Array.isArray(r.content)
    ? r.content.find((c) => c?.type === "text")?.text
    : undefined;
  let parsed = r.structuredContent ?? null;
  if (!parsed && textPart) {
    try { parsed = JSON.parse(textPart); } catch { parsed = { text: textPart }; }
  }
  return { isError: !!r.isError, data: parsed };
}

const report = {
  endpoint: ENDPOINT,
  ranAt: new Date().toISOString(),
  steps: {},
  notes: [
    "No write operations were issued. Only whoami, creator_my_workspace, and a Studio-only read (list_productions) were called.",
    "Bearer token was forwarded to the endpoint only; it is not present in this report.",
  ],
};

try {
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "streamvista-mcp-e2e-verifier", version: "1.0.0" },
  });
  const initOk = init.status === 200 && !!init.json?.result?.protocolVersion;
  report.steps.initialize = {
    result: initOk ? "PASS" : "FAIL",
    httpStatus: init.status,
    protocolVersion: init.json?.result?.protocolVersion ?? null,
    serverInfo: init.json?.result?.serverInfo ?? null,
    sessionIdReceived: !!sessionId,
  };
  if (!initOk) throw new Error("initialize failed");

  const notif = await rpc("notifications/initialized", {}, { notification: true });
  report.steps.notificationsInitialized = {
    httpStatus: notif.status,
    ok: notif.status >= 200 && notif.status < 300,
  };

  const list = await rpc("tools/list", {});
  const tools = list.json?.result?.tools ?? [];
  report.steps.toolsList = {
    httpStatus: list.status,
    count: tools.length,
    names: tools.map((t) => t.name),
  };

  const who = await rpc("tools/call", { name: "whoami", arguments: {} });
  const whoParsed = parseToolResult(who.json);
  const whoData = whoParsed.data ?? {};
  const whoEmail = whoData.email ?? whoData.user?.email ?? null;
  report.steps.whoami = {
    httpStatus: who.status,
    isError: whoParsed.isError ?? false,
    masked: maskDeep(whoData),
    identityMatchesExpectedEmail:
      EXPECTED_EMAIL == null ? "not-checked"
        : whoEmail && whoEmail.toLowerCase() === EXPECTED_EMAIL.toLowerCase()
          ? "MATCH" : "MISMATCH",
  };

  const ws = await rpc("tools/call", { name: "creator_my_workspace", arguments: {} });
  const wsParsed = parseToolResult(ws.json);
  const wsData = wsParsed.data ?? {};
  const wsIds = new Set();
  const collectIds = (v) => {
    if (Array.isArray(v)) {
      v.forEach(collectIds);
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (/workspace_id|workspaceId/i.test(k) && typeof val === "string") wsIds.add(val);
        collectIds(val);
      }
    }
  };
  collectIds(wsData);
  report.steps.creatorMyWorkspace = {
    httpStatus: ws.status,
    isError: wsParsed.isError ?? false,
    distinctWorkspaceIdCount: wsIds.size,
    onlyOwnWorkspaceVisible: wsIds.size <= 1,
    masked: maskDeep(wsData),
  };

  const studio = await rpc("tools/call", { name: "list_productions", arguments: {} });
  const studioParsed = parseToolResult(studio.json);
  const studioData = studioParsed.data;
  const rows = Array.isArray(studioData?.productions) ? studioData.productions
              : Array.isArray(studioData?.items) ? studioData.items
              : Array.isArray(studioData) ? studioData
              : [];
  const deniedByError = !!studioParsed.isError || !!studio.json?.error;
  const isolationOk = deniedByError || rows.length === 0;
  report.steps.crossRoleIsolationProbe = {
    tool: "list_productions",
    httpStatus: studio.status,
    isError: studioParsed.isError ?? false,
    rpcError: studio.json?.error?.message ?? null,
    rowCount: rows.length,
    result: isolationOk ? "PASS (no cross-role data leaked)" : "FAIL (rows returned)",
    masked: maskDeep(studioData ?? null),
  };

  report.summary = {
    initialize: report.steps.initialize.result,
    toolsListCount: report.steps.toolsList.count,
    whoamiIdentity: report.steps.whoami.identityMatchesExpectedEmail,
    workspaceIsolation: report.steps.creatorMyWorkspace.onlyOwnWorkspaceVisible ? "PASS" : "FAIL",
    crossRoleIsolation: isolationOk ? "PASS" : "FAIL",
    nothingChanged: true,
  };
} catch (err) {
  report.error = err?.message ?? String(err);
}

console.log(JSON.stringify(report, null, 2));
