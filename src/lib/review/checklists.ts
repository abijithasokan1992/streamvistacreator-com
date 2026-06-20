// Canonical QC + Legal checklist definitions for the review workflow.
// The DB persists user-set state; this file defines what we render.

export type ChecklistStage = "qc" | "legal";
export type ItemStatus = "pending" | "pass" | "fail" | "needs_attention" | "not_applicable";
export type Severity = "info" | "non_blocking" | "blocking";

export interface ChecklistItem {
  key: string;
  label: string;
  /** Default severity used when the reviewer first touches the item. */
  defaultSeverity: Severity;
  /** Whether failure on this item should be treated as a blocking issue. */
  blockingOnFail?: boolean;
}

export interface ChecklistGroup {
  group: string;
  label: string;
  items: ChecklistItem[];
}

export const QC_CHECKLIST: ChecklistGroup[] = [
  {
    group: "video",
    label: "A. Video / master quality",
    items: [
      { key: "qc_video_master_present",    label: "Master file present",                       defaultSeverity: "blocking", blockingOnFail: true },
      { key: "qc_video_runtime",           label: "Runtime verified",                          defaultSeverity: "non_blocking" },
      { key: "qc_video_resolution",        label: "Resolution verified",                       defaultSeverity: "non_blocking" },
      { key: "qc_video_codec",             label: "Codec / container acceptable",              defaultSeverity: "non_blocking" },
      { key: "qc_video_playback",          label: "Playback opens successfully",               defaultSeverity: "blocking", blockingOnFail: true },
      { key: "qc_video_integrity",         label: "No corruption / truncation detected",       defaultSeverity: "blocking", blockingOnFail: true },
    ],
  },
  {
    group: "audio",
    label: "B. Audio",
    items: [
      { key: "qc_audio_present",   label: "Audio track present",                  defaultSeverity: "blocking", blockingOnFail: true },
      { key: "qc_audio_sync",      label: "Sync appears correct",                 defaultSeverity: "non_blocking" },
      { key: "qc_audio_channels",  label: "Channel layout acceptable",            defaultSeverity: "non_blocking" },
      { key: "qc_audio_balance",   label: "Dialogue/music/FX not broken",         defaultSeverity: "non_blocking" },
      { key: "qc_audio_levels",    label: "No severe clipping / silence",         defaultSeverity: "non_blocking" },
    ],
  },
  {
    group: "subtitles",
    label: "C. Subtitle / caption / text assets",
    items: [
      { key: "qc_sub_available",  label: "Subtitles available if required",       defaultSeverity: "non_blocking" },
      { key: "qc_sub_readable",   label: "Subtitle file readable",                defaultSeverity: "non_blocking" },
      { key: "qc_sub_lang_tag",   label: "Language tagged correctly",             defaultSeverity: "info" },
      { key: "qc_sub_timing",     label: "Spot-check timing acceptable",          defaultSeverity: "non_blocking" },
    ],
  },
  {
    group: "artwork",
    label: "D. Poster / artwork / promo",
    items: [
      { key: "qc_art_poster",      label: "Poster present",                       defaultSeverity: "blocking", blockingOnFail: true },
      { key: "qc_art_ratio",       label: "Aspect ratio acceptable",              defaultSeverity: "non_blocking" },
      { key: "qc_art_treatment",   label: "Readable title treatment",             defaultSeverity: "non_blocking" },
      { key: "qc_art_no_placeholder", label: "No placeholder / broken artwork",   defaultSeverity: "non_blocking" },
    ],
  },
  {
    group: "metadata",
    label: "E. Metadata consistency",
    items: [
      { key: "qc_meta_title",      label: "Title name matches submitted metadata", defaultSeverity: "non_blocking" },
      { key: "qc_meta_runtime",    label: "Runtime metadata matches asset",        defaultSeverity: "non_blocking" },
      { key: "qc_meta_fields",     label: "Synopsis / language / year / genre present", defaultSeverity: "non_blocking" },
    ],
  },
  {
    group: "delivery",
    label: "F. Delivery readiness",
    items: [
      { key: "qc_deliv_assets",    label: "Required primary delivery assets present", defaultSeverity: "blocking", blockingOnFail: true },
      { key: "qc_deliv_no_block",  label: "No blocking QC issue remaining",           defaultSeverity: "blocking", blockingOnFail: true },
    ],
  },
];

export const LEGAL_CHECKLIST: ChecklistGroup[] = [
  {
    group: "rights",
    label: "A. Ownership / rights chain",
    items: [
      { key: "lg_rights_declaration",  label: "Ownership declaration provided",     defaultSeverity: "blocking", blockingOnFail: true },
      { key: "lg_rights_holder",       label: "Rights holder name present",         defaultSeverity: "blocking", blockingOnFail: true },
      { key: "lg_rights_authority",    label: "Submitter authority confirmed",      defaultSeverity: "non_blocking" },
      { key: "lg_rights_chain_note",   label: "Chain-of-title / rights note captured", defaultSeverity: "info" },
    ],
  },
  {
    group: "censor",
    label: "B. Censor / certification",
    items: [
      { key: "lg_cen_cert_present", label: "Censor certificate present if applicable", defaultSeverity: "non_blocking" },
      { key: "lg_cen_cert_number",  label: "Certificate number / authority captured", defaultSeverity: "info" },
      { key: "lg_cen_class_notes",  label: "Classification notes recorded",            defaultSeverity: "info" },
    ],
  },
  {
    group: "music",
    label: "C. Music / third-party rights",
    items: [
      { key: "lg_music_rights",      label: "Music rights status acknowledged",   defaultSeverity: "non_blocking" },
      { key: "lg_3p_footage",        label: "Third-party footage / archive flagged", defaultSeverity: "non_blocking" },
      { key: "lg_3p_unresolved",     label: "Unresolved rights concerns captured",   defaultSeverity: "info" },
    ],
  },
  {
    group: "talent",
    label: "D. Talent / contributor / release",
    items: [
      { key: "lg_talent_releases",   label: "Contributor release concerns noted",  defaultSeverity: "non_blocking" },
      { key: "lg_talent_minors",     label: "Minors / likeness / consent flagged", defaultSeverity: "non_blocking" },
    ],
  },
  {
    group: "territory",
    label: "E. Territory / language / version",
    items: [
      { key: "lg_terr_restrictions", label: "Territory restrictions known",    defaultSeverity: "info" },
      { key: "lg_terr_lang_notes",   label: "Language / version notes captured", defaultSeverity: "info" },
    ],
  },
  {
    group: "legal_decision",
    label: "F. Legal readiness decision",
    items: [
      { key: "lg_no_block_remaining", label: "No blocking legal issue remaining", defaultSeverity: "blocking", blockingOnFail: true },
    ],
  },
];

export function getChecklist(stage: ChecklistStage): ChecklistGroup[] {
  return stage === "qc" ? QC_CHECKLIST : LEGAL_CHECKLIST;
}

// ---- Structured send-back / change-request reasons ----

export interface ReasonOption {
  key: string;
  label: string;
  group: "qc_asset" | "legal_doc" | "general";
  stage: "qc" | "legal" | "general";
  defaultSeverity: Severity;
}

export const SEND_BACK_REASONS: ReasonOption[] = [
  // QC / asset
  { key: "missing_master",       label: "Missing master file",            group: "qc_asset", stage: "qc", defaultSeverity: "blocking" },
  { key: "corrupt_media",        label: "Corrupt / invalid media",        group: "qc_asset", stage: "qc", defaultSeverity: "blocking" },
  { key: "audio_issue",          label: "Audio issue",                    group: "qc_asset", stage: "qc", defaultSeverity: "blocking" },
  { key: "subtitle_issue",       label: "Subtitle issue",                 group: "qc_asset", stage: "qc", defaultSeverity: "non_blocking" },
  { key: "artwork_issue",        label: "Artwork issue",                  group: "qc_asset", stage: "qc", defaultSeverity: "non_blocking" },
  { key: "metadata_mismatch",    label: "Metadata mismatch",              group: "qc_asset", stage: "qc", defaultSeverity: "non_blocking" },
  { key: "incomplete_deliv",     label: "Incomplete deliverables",        group: "qc_asset", stage: "qc", defaultSeverity: "blocking" },
  // Legal / documentation
  { key: "missing_censor",       label: "Missing censor certificate",     group: "legal_doc", stage: "legal", defaultSeverity: "blocking" },
  { key: "ownership_incomplete", label: "Ownership proof incomplete",     group: "legal_doc", stage: "legal", defaultSeverity: "blocking" },
  { key: "rights_clarification", label: "Rights clarification needed",    group: "legal_doc", stage: "legal", defaultSeverity: "non_blocking" },
  { key: "music_rights",         label: "Music rights concern",           group: "legal_doc", stage: "legal", defaultSeverity: "non_blocking" },
  { key: "territory_version",    label: "Territory / version clarification", group: "legal_doc", stage: "legal", defaultSeverity: "non_blocking" },
  // General
  { key: "incomplete_submission",label: "Incomplete submission",          group: "general",   stage: "general", defaultSeverity: "blocking" },
  { key: "admin_clarification",  label: "Admin clarification required",   group: "general",   stage: "general", defaultSeverity: "non_blocking" },
  { key: "other",                label: "Other",                          group: "general",   stage: "general", defaultSeverity: "non_blocking" },
];

export const REASON_GROUP_LABELS: Record<string, string> = {
  qc_asset:  "QC / asset issues",
  legal_doc: "Legal / documentation issues",
  general:   "General",
};
