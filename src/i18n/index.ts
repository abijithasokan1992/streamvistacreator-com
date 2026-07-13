/**
 * i18n bootstrap — react-i18next with two catalogs (English + Malayalam).
 *
 * Persistence strategy:
 *   • Runtime language is stored in localStorage under LOCALE_STORAGE_KEY so it
 *     survives refresh + sign-out on the same device.
 *   • Signed-in users' preference is mirrored into `user_profiles.locale`
 *     (see `useLocale`), so it follows them across devices and after re-login.
 *   • First-time visitors get no forced default — the app renders in English
 *     as a temporary fallback until the user picks a language via the
 *     LanguagePicker modal (shown on first Creator Dashboard visit).
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import ml from "./locales/ml.json";

export const SUPPORTED_LOCALES = ["en", "ml"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_STORAGE_KEY = "sv.locale";
export const LOCALE_CHOSEN_KEY = "sv.locale.chosen";

/**
 * Read locale from localStorage without ever throwing (SSR / private-mode safe).
 * Returns `null` when the user has not picked a language yet.
 */
export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return v === "en" || v === "ml" ? v : null;
  } catch {
    return null;
  }
}

export function hasChosenLocale(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCALE_CHOSEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLocaleChosen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_CHOSEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ml: { translation: ml },
    },
    // Temporary fallback per product spec: if no preference is stored yet
    // (or storage is unavailable), render English until the user picks.
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    returnNull: false,
  });

export default i18n;
