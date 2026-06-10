import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import CameraToCloudIngest from "@/components/studio/CameraToCloudIngest";

export default function Studio() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/dashboard"))}
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
        </div>
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">StreamVista Creator Studio</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Cloud X · Ingest</h1>
        </div>
        <CameraToCloudIngest />
      </div>
    </main>
  );
}
