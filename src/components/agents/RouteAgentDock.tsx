import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AgentDock } from "./AgentDock";
import type { AgentSurface } from "./AgentChat";
import { useAuth } from "@/hooks/useAuth";
import { fetchFreeTierStatus } from "@/lib/creator/titleApi";

/**
 * Route-aware launcher: mounts the right surface agent based on the URL.
 * Free Creator users do not get Aria (the Creator AI surface) — paid surface only.
 */
export function RouteAgentDock() {
  const { pathname } = useLocation();
  const { session, loading, user } = useAuth();
  const [isFree, setIsFree] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsFree(null); return; }
    let cancelled = false;
    (async () => {
      const t = await fetchFreeTierStatus();
      if (!cancelled) setIsFree(!!t?.is_free);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) return null;
  if (loading) return null;
  if (!session) return null;

  let surface: AgentSurface = "home";
  if (pathname === "/" || pathname === "/home") surface = "home";
  else if (pathname.startsWith("/dashboard/content") || pathname.startsWith("/vault") || pathname.startsWith("/projects")) surface = "creator";
  else if (pathname.startsWith("/dashboard/studio") || pathname.startsWith("/studio") || pathname.startsWith("/archive") || pathname.startsWith("/team")) surface = "studio";
  else if (pathname.startsWith("/dashboard/buyer") || pathname.startsWith("/screening")) surface = "buyer";
  else surface = "home";

  // Aria/Creator AI is a paid surface — hide for free-tier creators.
  if (surface === "creator" && isFree) return null;

  return <AgentDock surface={surface} />;
}

