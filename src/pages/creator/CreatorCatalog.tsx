import MyTitles from "@/components/creator/sections/MyTitles";
import { ModuleHeader } from "@/components/creator/shell/ModuleHeader";

export default function CreatorCatalog() {
  return (
    <>
      <ModuleHeader
        eyebrow="Studio"
        title="Catalog"
        subtitle="Every film, series and short you own on StreamVista. Add new titles, resume drafts, or open a title to manage its metadata, media and rights."
      />
      <MyTitles />
    </>
  );
}
