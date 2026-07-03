import { Helmet } from "react-helmet-async";
import SmartDropUploader from "@/components/uploads/SmartDropUploader";
import Navbar from "@/components/streamvista/Navbar";

export default function SmartUploadsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Helmet>
        <title>Smart Uploads — StreamVista</title>
        <meta name="description" content="Professional drag-and-drop uploads with intelligent auto-foldering, SHA-256 verification, live throughput and per-file ETA." />
      </Helmet>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <header className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Smart Uploads</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Drop files or entire folders. StreamVista intelligently organizes every asset by project, date, camera, reel, scene, and media type — with SHA-256 verification and live progress on every file.
          </p>
        </header>
        <SmartDropUploader />
      </main>
    </div>
  );
}
