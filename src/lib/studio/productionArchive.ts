type CrewRecord = Record<string, unknown>;

export function archiveProductionCrew(crew: CrewRecord | null | undefined) {
  const next: CrewRecord = { ...(crew ?? {}) };
  const current = String(next.title_status ?? "").trim();
  if (current && current.toLowerCase() !== "archived") {
    next.archived_from_status = current;
  }
  next.title_status = "Archived";
  return next;
}

export function restoreProductionCrew(crew: CrewRecord | null | undefined) {
  const next: CrewRecord = { ...(crew ?? {}) };
  const fallback = String(next.archived_from_status ?? "").trim();
  delete next.archived_from_status;
  if (fallback && fallback.toLowerCase() !== "archived") {
    next.title_status = fallback;
  } else {
    delete next.title_status;
  }
  return next;
}
