import CameraToCloudIngest from "@/components/studio/CameraToCloudIngest";

export default function Studio() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">StreamVista Creator Studio</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Cloud X · Ingest</h1>
        </div>
        <CameraToCloudIngest />
      </div>
    </main>
  );
}
