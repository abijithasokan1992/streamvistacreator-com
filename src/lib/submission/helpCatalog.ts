/**
 * Static bilingual help catalog — ZERO AI.
 *
 * "Explain this" and common field questions read from here.
 * Adding a new field: append an entry. Never call the model for these.
 */
export type HelpTopicId =
  | "synopsis"
  | "rights_owner"
  | "territory"
  | "language"
  | "duration_minutes"
  | "master_upload"
  | "poster_upload"
  | "kind"
  | "director"
  | "genre"
  | "content_warnings"
  | "terms";

export interface HelpEntry {
  en: string;
  ml: string;
}

export const HELP_CATALOG: Record<HelpTopicId, HelpEntry> = {
  synopsis: {
    en: "A short plot summary of your film (80–4000 characters). Focus on the story, not the cast. We use this to auto-suggest genre and tags.",
    ml: "നിങ്ങളുടെ ചിത്രത്തിന്റെ കഥാസംഗ്രഹം (80–4000 അക്ഷരങ്ങൾ). താരനിരയേക്കാൾ കഥയിലേക്ക് ശ്രദ്ധിക്കുക. തരവും ടാഗുകളും ഇതിൽ നിന്ന് നിർദേശിക്കപ്പെടും.",
  },
  rights_owner: {
    en: "The person or company that legally owns the film's distribution rights. Usually the producer or production house named in the CBFC / MoU documents.",
    ml: "ചിത്രത്തിന്റെ വിതരണ അവകാശം നിയമപരമായി ഉള്ള വ്യക്തി അല്ലെങ്കിൽ കമ്പനി. സാധാരണയായി സിബിഎഫ്‌സി / MoU രേഖകളിൽ പേരുള്ള നിർമ്മാതാവ്.",
  },
  territory: {
    en: "The geographic region for which you hold distribution rights (e.g. India, Worldwide, Kerala Only). This must match your contracts.",
    ml: "വിതരണ അവകാശം ഉള്ള പ്രദേശം (ഉദാ. ഇന്ത്യ, ലോകവ്യാപകം, കേരളം മാത്രം). ഇത് നിങ്ങളുടെ കരാറുകളുമായി പൊരുത്തപ്പെടണം.",
  },
  language: {
    en: "The primary spoken language of your film. Dubbed versions are added separately.",
    ml: "ചിത്രത്തിന്റെ പ്രധാന ഭാഷ. ഡബ്ബ് ചെയ്ത പതിപ്പുകൾ പ്രത്യേകം ചേർക്കാം.",
  },
  duration_minutes: {
    en: "Total runtime of the finished film in minutes.",
    ml: "പൂർത്തിയായ ചിത്രത്തിന്റെ മൊത്തം ദൈർഘ്യം (മിനിറ്റ്).",
  },
  master_upload: {
    en: "The final delivery master. Preferred formats: ProRes 422 HQ, DNxHR, or high-bitrate H.264/H.265 MP4. Aspect ratio and audio channels are auto-checked.",
    ml: "അന്തിമ ഡെലിവറി മാസ്റ്റർ. അനുയോജ്യ ഫോർമാറ്റുകൾ: ProRes 422 HQ, DNxHR, അല്ലെങ്കിൽ ഉയർന്ന ബിറ്റ്റേറ്റ് MP4. അസ്‌പെക്റ്റ് അനുപാതവും ഓഡിയോ ചാനലുകളും സ്വയമേവ പരിശോധിക്കപ്പെടും.",
  },
  poster_upload: {
    en: "Portrait key art at least 1080×1620 (2:3). JPG or PNG.",
    ml: "കുറഞ്ഞത് 1080×1620 (2:3) പോർട്രെയിറ്റ് പോസ്റ്റർ. JPG അല്ലെങ്കിൽ PNG.",
  },
  kind: {
    en: "Film, Series, Episode, or Short. Series need a season and episode number per entry.",
    ml: "ചിത്രം, സീരീസ്, എപ്പിസോഡ്, അല്ലെങ്കിൽ ഹ്രസ്വചിത്രം. സീരീസുകൾക്ക് ഓരോ എൻട്രിക്കും സീസൺ, എപ്പിസോഡ് നമ്പർ വേണം.",
  },
  director: {
    en: "The credited director of the film. Multiple directors: comma-separate.",
    ml: "ചിത്രത്തിന്റെ ക്രെഡിറ്റ് ചെയ്ത സംവിധായകൻ. ഒന്നിലധികം സംവിധായകർ ഉണ്ടെങ്കിൽ കോമ ചേർത്ത് വേർതിരിക്കുക.",
  },
  genre: {
    en: "Primary genre. Auto-suggested from your synopsis after you finish typing.",
    ml: "പ്രധാന തരം. നിങ്ങൾ കഥാസംഗ്രഹം എഴുതി കഴിഞ്ഞാൽ സ്വയമേവ നിർദ്ദേശിക്കപ്പെടും.",
  },
  content_warnings: {
    en: "Advisory flags for viewers (violence, language, mature themes). Required for certain distribution partners.",
    ml: "കാഴ്ചക്കാർക്കുള്ള മുന്നറിയിപ്പുകൾ (അക്രമം, ഭാഷ, മുതിർന്നവർക്കുള്ള വിഷയങ്ങൾ). ചില വിതരണ പങ്കാളികൾക്ക് നിർബന്ധം.",
  },
  terms: {
    en: "By accepting, you confirm you have all necessary rights and consents to submit this title for review.",
    ml: "സമ്മതിക്കുന്നതിലൂടെ, ഈ ചിത്രം സമർപ്പിക്കാൻ ആവശ്യമായ എല്ലാ അവകാശങ്ങളും സമ്മതങ്ങളും നിങ്ങൾക്കുണ്ടെന്ന് സ്ഥിരീകരിക്കുന്നു.",
  },
};

export function getHelp(topic: HelpTopicId, locale: "en" | "ml"): string {
  return HELP_CATALOG[topic]?.[locale] ?? "";
}

/** Bilingual fallback banner shown when AI is disabled or rate-limited. */
export const AI_UNAVAILABLE_MESSAGE = {
  en: "AI suggestions are temporarily unavailable. You can continue your submission.",
  ml: "AI നിർദ്ദേശങ്ങൾ ഇപ്പോൾ ലഭ്യമല്ല. നിങ്ങൾക്ക് സമർപ്പണം തുടരാം.",
} as const;
