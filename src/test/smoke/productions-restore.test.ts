import { describe, it, expect } from "vitest";
import { archiveProductionCrew, restoreProductionCrew } from "@/lib/studio/productionArchive";

describe("production archive restore helpers", () => {
  it("preserves the previous status when archiving then restoring", () => {
    const archived = archiveProductionCrew({ title_status: "Delivery", owner: "studio" });
    expect(archived).toMatchObject({
      title_status: "Archived",
      archived_from_status: "Delivery",
      owner: "studio",
    });

    expect(restoreProductionCrew(archived)).toEqual({
      title_status: "Delivery",
      owner: "studio",
    });
  });

  it("restores archived productions without a saved prior status back to live", () => {
    expect(restoreProductionCrew({ title_status: "Archived", owner: "studio" })).toEqual({
      owner: "studio",
    });
  });

  it("does not overwrite an existing archived origin with archived again", () => {
    expect(archiveProductionCrew({
      title_status: "Archived",
      archived_from_status: "Production",
    })).toEqual({
      title_status: "Archived",
      archived_from_status: "Production",
    });
  });
});
