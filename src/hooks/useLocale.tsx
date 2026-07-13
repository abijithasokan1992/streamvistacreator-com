import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LOCALE_STORAGE_KEY,
  hasChosenLocale,
  markLocaleChosen,
  readStoredLocale,
  type Locale,
} from "@/i18n";

/**
 * useLocale — single source of truth for the user's interface language.
 *
 * Responsibilities:
 *   • Expose the current locale + a setter that updates i18next, localStorage,
 *     and (for signed-in users) `user_profiles.locale`.
 *   • On sign-in, if the user has NOT yet picked a language on this device,
 *     prefer the server-side stored preference (`user_profiles.locale`).
 *   • Never coerce a user to a language — first-time users see the picker
 *     rendered separately by the dashboard.
 */
export function useLocale() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(
    (i18n.language === "ml" ? "ml" : "en") as Locale,
  );
  const [chosen, setChosen] = useState<boolean>(hasChosenLocale());

  // Keep local state in sync with i18n's language changes triggered elsewhere.
  useEffect(() => {
    const handler = (lng: string) => {
      setLocaleState(lng === "ml" ? "ml" : "en");
    };
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, [i18n]);

  // Hydrate from server when the user signs in and the device has no choice yet.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("user_profiles")
          .select("locale")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const serverLocale: Locale | null =
          data?.locale === "ml" || data?.locale === "en" ? data.locale : null;
        const local = readStoredLocale();
        if (!local && serverLocale) {
          await i18n.changeLanguage(serverLocale);
          try {
            window.localStorage.setItem(LOCALE_STORAGE_KEY, serverLocale);
          } catch {
            /* ignore */
          }
          markLocaleChosen();
          setChosen(true);
        } else if (local && !serverLocale) {
          // Mirror the device choice up to the server so it follows the user.
          await (supabase as any)
            .from("user_profiles")
            .update({ locale: local })
            .eq("user_id", user.id);
        }
      } catch {
        /* non-fatal — keep the current locale */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, i18n]);

  const setLocale = useCallback(
    async (next: Locale) => {
      await i18n.changeLanguage(next);
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      markLocaleChosen();
      setChosen(true);
      setLocaleState(next);
      if (user?.id) {
        try {
          await (supabase as any)
            .from("user_profiles")
            .update({ locale: next })
            .eq("user_id", user.id);
        } catch {
          /* non-fatal — device choice still holds */
        }
      }
    },
    [i18n, user?.id],
  );

  return { locale, setLocale, chosen };
}
