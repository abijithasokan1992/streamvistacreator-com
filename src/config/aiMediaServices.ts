/**
 * StreamVista AI Media Services — canonical service catalogue.
 *
 * Prices are intentionally NOT defined here. Every AI media service is
 * quoted per project by an operator (`sv_service_quotes`) and charged
 * server-side. Never render or send a client-side amount.
 */

export type AiServiceType =
  | "ai_dubbing"
  | "ai_subtitles_translation"
  | "audio_description"
  | "ai_editing_post"
  | "image_poster_generation"
  | "ott_tv_delivery_package";

export type ServiceWorkflow =
  | "creator_producer_intake"
  | "licensing_buyer"
  | "crayons_loop";

export interface AiMediaService {
  id: AiServiceType;
  name: string;
  tagline: string;
  bullets: string[];
}

export const AI_MEDIA_SERVICES: AiMediaService[] = [
  {
    id: "ai_dubbing",
    name: "AI Dubbing",
    tagline: "Voice your film into new markets without losing performance intent.",
    bullets: ["Multi-language voice tracks", "Character-consistent casting", "Human review before delivery"],
  },
  {
    id: "ai_subtitles_translation",
    name: "AI Subtitles & Translation",
    tagline: "Broadcast-grade subtitle and translation packages.",
    bullets: ["SRT / VTT / TTML output", "Timing and reading-rate checks", "Native-language QC pass"],
  },
  {
    id: "audio_description",
    name: "Audio Description",
    tagline: "Accessibility tracks that meet platform compliance requirements.",
    bullets: ["Descriptive narration track", "Placement against dialogue gaps", "Compliance-oriented review"],
  },
  {
    id: "ai_editing_post",
    name: "AI Editing & Post Support",
    tagline: "Assisted post work with a human editor accountable for the cut.",
    bullets: ["Assembly and trims", "Cleanup and conform support", "Deliverable-ready masters"],
  },
  {
    id: "image_poster_generation",
    name: "Image / Poster Generation",
    tagline: "Key art and campaign imagery prepared for platform specs.",
    bullets: ["Poster and banner sets", "Platform aspect-ratio variants", "Rights-checked source material"],
  },
  {
    id: "ott_tv_delivery_package",
    name: "OTT / TV Delivery Package",
    tagline: "A complete delivery bundle assembled to platform specification.",
    bullets: ["Master + audio + subtitle set", "Metadata and artwork package", "Delivery QC report"],
  },
];

export const SERVICE_WORKFLOWS: { id: ServiceWorkflow; label: string; description: string }[] = [
  {
    id: "creator_producer_intake",
    label: "Creator / Producer Intake",
    description: "You own or produce the content and need production services.",
  },
  {
    id: "licensing_buyer",
    label: "Licensing & Buyer Workflow",
    description: "You are preparing a title for a buyer, platform or licensing deal.",
  },
  {
    id: "crayons_loop",
    label: "Crayons Loop",
    description: "Ongoing recurring work under the Crayons Loop production programme.",
  },
];

export function getAiMediaService(id: string | null | undefined): AiMediaService | undefined {
  return AI_MEDIA_SERVICES.find((s) => s.id === id);
}

export const CREATOR_TYPES = [
  "Independent Filmmaker",
  "Production House",
  "Studio",
  "Distributor / Buyer",
  "Agency / Brand",
  "Other",
] as const;

export const MATERIAL_READINESS = [
  { value: "master_ready", label: "Final master ready" },
  { value: "rough_cut", label: "Rough cut / work in progress" },
  { value: "raw_material", label: "Raw material only" },
  { value: "not_started", label: "Nothing prepared yet" },
] as const;
