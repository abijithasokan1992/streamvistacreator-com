import { supabase } from "@/integrations/supabase/client";

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

export async function runAgent<T = unknown>(request: AgentRunRequest): Promise<AgentRunResult<T>> {
  const { data, error } = await supabase.functions.invoke("ente-agent-run", {
    body: {
      agentId: request.agentId,
      input: request.input,
      context: request.context ?? {},
    },
  });

  if (error) {
    return {
      runId: "failed",
      status: "failed",
      error: {
        code: "ente_agent_proxy_failed",
        message: error.message || "ENTE Agent Runtime proxy request failed.",
      },
    };
  }

  if (!data || typeof data !== "object") {
    return {
      runId: "failed",
      status: "failed",
      error: {
        code: "invalid_ente_response",
        message: "ENTE Agent Runtime returned an invalid response.",
      },
    };
  }

  return data as AgentRunResult<T>;
}
