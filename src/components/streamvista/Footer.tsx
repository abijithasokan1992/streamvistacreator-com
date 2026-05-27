import { Link } from "react-router-dom";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Footer = () => {
  const [copied, setCopied] = useState(false);
  const adminUrl = typeof window !== "undefined" ? `${window.location.origin}/admin` : "/admin";

  const copyAdmin = async () => {
    try {
      await navigator.clipboard.writeText(adminUrl);
      setCopied(true);
      toast.success("Admin link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <footer className="border-t border-border/50 py-10 mt-10">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} StreamVista Cloud X · Crayons Creator Cloud Portal</div>
        <div className="flex flex-wrap gap-6 items-center">
          <span>India region · Mumbai</span>
          <span>99.9% Uptime SLA</span>
          <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
          <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border/70 bg-secondary/40">
            <Link to="/admin" className="font-mono text-foreground hover:text-accent">/admin</Link>
            <button
              onClick={copyAdmin}
              aria-label="Copy admin panel link"
              className="text-muted-foreground hover:text-accent transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
