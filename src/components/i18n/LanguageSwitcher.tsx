import { useLocale } from "@/hooks/useLocale";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";

/**
 * LanguageSwitcher — header-mounted control that lets a user flip between
 * Malayalam and English at any time. Persisted via `useLocale`.
 */
export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("language.switcherLabel", "Language")}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
      >
        <Globe className="w-3.5 h-3.5" />
        <span
          style={
            locale === "ml"
              ? { fontFamily: "'Noto Sans Malayalam', system-ui, sans-serif" }
              : undefined
          }
          lang={locale}
        >
          {locale === "ml" ? "മലയാളം" : "English"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {t("language.switcherLabel", "Language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocale("ml")} className="cursor-pointer">
          <span
            className="flex-1"
            style={{ fontFamily: "'Noto Sans Malayalam', system-ui, sans-serif" }}
            lang="ml"
          >
            മലയാളം
          </span>
          {locale === "ml" && <Check className="w-3.5 h-3.5 text-accent" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("en")} className="cursor-pointer">
          <span className="flex-1">English</span>
          {locale === "en" && <Check className="w-3.5 h-3.5 text-accent" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
