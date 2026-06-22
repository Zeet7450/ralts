"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocaleStore } from "@/stores/locale-store";
import type { Locale } from "@/types";

const languages: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "id", label: "Bahasa Indonesia", nativeLabel: "Bahasa Indonesia" },
  { code: "zh", label: "Mandarin Chinese", nativeLabel: "简体中文" },
];

export default function LanguageSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale, setLocale } = useLocaleStore();

  const handleSelect = (code: Locale) => {
    setLocale(code);
    // Force re-render by updating cookie for server components
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000`;
    // Small delay to allow cookie to be set, then router refresh
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-xl font-semibold">{t("settings.language")}</h1>
      </div>

      <div className="space-y-2">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-surface hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <div className="text-left">
              <p className="text-sm font-medium text-text-primary">{lang.nativeLabel}</p>
              <p className="text-xs text-text-secondary">{lang.label}</p>
            </div>
            {locale === lang.code && (
              <Check className="h-4 w-4 text-accent" strokeWidth={2} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
