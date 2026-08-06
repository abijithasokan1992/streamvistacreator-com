export type AgentRunRequest = {
  agentId: string;
  input: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export type AgentRunResult<T = unknown> = {
  runId: string;
  status: "completed" | "approval_required" | "failed";
  output?: T;
  error?: { code: string; message: string };
};

const baseUrl = (import.meta.env.VITE_AGENT_PLATFORM_URL as string | undefined)?.replace(/\/$/, "");

export async function runAgent<T = unknown>(request: AgentRunRequest): Promise<AgentRunResult<T>> {
  if (!baseUrl) {
    return {
      runId: "not-started",
      status: "failed",
      error: {
        code: "agent_platform_not_configured",
        message: "VITE_AGENT_PLATFORM_URL is not configured.",
      },
    };
  }

  const response = await fetch(`${baseUrl}/api/agents/${encodeURIComponent(request.agentId)}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ input: request.input, context: request.context ?? {} }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      runId: body?.runId ?? "failed",
      status: "failed",
      error: {
        code: body?.error?.code ?? "agent_platform_request_failed",
        message: body?.error?.message ?? `Agent Platform returned HTTP ${response.status}.`,
      },
    };
  }

  return body as AgentRunResult<T>;
}
