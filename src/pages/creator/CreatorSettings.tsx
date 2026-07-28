import { useState } from "react";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";
import Storage from "@/components/creator/sections/Storage";
import Help from "@/components/creator/sections/Help";
import MyCreatorProfile from "@/pages/profile/MyCreatorProfile";
import Statements from "@/components/creator/sections/Statements";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function CreatorSettings() {
  const [tab, setTab] = useState("profile");
  return (
    <>
      <ModuleHeader
        eyebrow="Account"
        title="Settings & Team"
        subtitle="Profile, storage, billing and workspace controls."
      />
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <MyCreatorProfile embedded />
        </TabsContent>
        <TabsContent value="storage">
          <Storage />
        </TabsContent>
        <TabsContent value="billing">
          <Statements />
        </TabsContent>
        <TabsContent value="help">
          <Help />
        </TabsContent>
      </Tabs>
    </>
  );
}
