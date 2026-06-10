import TeamMembersPanel from "@/components/dashboard/TeamMembersPanel";

export default function Team() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Team Members</h1>
          <p className="text-muted-foreground">
            Invite your crew to collaborate inside your workspace.
          </p>
        </div>
        <TeamMembersPanel />
      </div>
    </div>
  );
}
