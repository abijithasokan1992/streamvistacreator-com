import { useLocation } from "react-router-dom";
import { AgentDock } from "./AgentDock";
import type { AgentSurface } from "./AgentChat";
import { useAuth } from "@/hooks/useAuth";

/**
 * Route-aware launcher: mounts the right surface agent based on the URL.
 * - "/" or "/home" → Vista (concierge) — authenticated visitors only,
 *   because agent-chat requires a bearer token on every surface.
 * - "/dashboard/content" or any creator workspace → Aria
 * - "/dashboard/studio" or "/studio" → Orion
 * - "/dashboard/buyer" → Atlas
 * - "/admin/*" → no surface agent (Chief AI lives inside Admin → Chief tab)
 */
export function RouteAgentDock() {
  const { pathname } = useLocation();
  const { session, loading } = useAuth();

  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) return null;

  // Do not mount any agent dock for unauthenticated visitors — the underlying
  // edge function (`agent-chat`) is auth-gated and would 401 on every send.
  if (loading) return null;
  if (!session) return null;

  let surface: AgentSurface = "home";
  if (pathname === "/" || pathname === "/home") surface = "home";
  else if (pathname.startsWith("/dashboard/content") || pathname.startsWith("/vault") || pathname.startsWith("/projects")) surface = "creator";
  else if (pathname.startsWith("/dashboard/studio") || pathname.startsWith("/studio") || pathname.startsWith("/archive") || pathname.startsWith("/team")) surface = "studio";
  else if (pathname.startsWith("/dashboard/buyer") || pathname.startsWith("/screening")) surface = "buyer";
  else surface = "home";

  return <AgentDock surface={surface} />;
}
