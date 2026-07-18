import { describe, expect, it } from "vitest";
import {
  legacyImportKey,
  mapLegacyFilmDraftRow,
  mapLegacyFilmRow,
} from "@/lib/creator/legacyTitleAdapter";

describe("legacy Crayons title JSON contract", () => {
  it("maps Harshiv's saved Bahumukham record to both canonical and metadata truth", () => {
    const mapped = mapLegacyFilmRow({
      id: 37,
      uuid: "54a4bbedff044d21a3b756f973172b64",
      title: "Bahumukham - Good, Bad & The Actor",
      description: "Legacy synopsis",
      content_type: "Feature Film",
      director: "Harshiv Karthik",
      producer: "Harshiv Karthik",
      duration: 87,
      language: "Telugu",
      country: "India",
      release_date: "2024-04-05",
    });

    expect(mapped.legacy_source_table).toBe("films_film");
    expect(mapped.legacy_source_id).toBe("37");
    expect(mapped.legacy_source_uuid).toBe("54a4bbedff044d21a3b756f973172b64");
    expect(mapped.language).toBe("Telugu");
    expect(mapped.duration_minutes).toBe(87);
    expect(mapped.metadata.original_language).toBe("Telugu");
    expect(mapped.metadata.runtime_minutes).toBe(87);
    expect(mapped.metadata.format).toBe("feature_film");
    expect(mapped.metadata.country_of_origin).toBe("India");
    expect(mapped.metadata.production_year).toBe(2024);
  });

  it("uses a stable source identity so repeated imports cannot create a second title", () => {
    const mapped = mapLegacyFilmRow({ id: 37, title: "Bahumukham" });
    expect(legacyImportKey(mapped)).toBe("films_film:37");
    expect(legacyImportKey(mapLegacyFilmRow({ id: 37, title: "Renamed locally" })))
      .toBe("films_film:37");
  });

  it("keeps film drafts in a separate identity namespace", () => {
    const mapped = mapLegacyFilmDraftRow({
      id: "58a6c213-1e0a-4ac9-beaa-8675df6db8e6",
      title: "Jananam 1947 Pranayam Thudarunnu",
      duration: "105",
      language: "Malayalam",
    });
    expect(mapped.legacy_source_table).toBe("films_filmdraft");
    expect(mapped.duration_minutes).toBe(105);
    expect(mapped.metadata.runtime_minutes).toBe(105);
    expect(legacyImportKey(mapped)).toBe(
      "films_filmdraft:58a6c213-1e0a-4ac9-beaa-8675df6db8e6",
    );
  });

  it.each([null, "", "0", "abc", "999999"])(
    "does not cast unsafe legacy duration %p",
    (duration) => {
      const mapped = mapLegacyFilmRow({ id: 1, title: "Safe", duration });
      expect(mapped.duration_minutes).toBeNull();
      expect(mapped.metadata.runtime_minutes).toBe(0);
    },
  );
});
