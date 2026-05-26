import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="border-t border-border/50 py-10 mt-10">
    <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
      <div>© {new Date().getFullYear()} StreamVista Cloud X · Crayons Creator Cloud Portal</div>
      <div className="flex flex-wrap gap-6 items-center">
        <span>India region · Mumbai</span>
        <span>99.9% Uptime SLA</span>
        <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
        <Link to="/auth" className="hover:text-foreground transition-colors">Admin</Link>
      </div>
    </div>
  </footer>
);
