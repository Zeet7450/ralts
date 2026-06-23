"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Moon, Sun, Globe, Bell, LogOut, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/theme-store";
import { useLocaleStore } from "@/stores/locale-store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "id", label: "Indonesia" },
  { code: "zh", label: "中文" },
] as const;

export default function SettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { theme, setTheme } = useThemeStore();
  const { locale, setLocale } = useLocaleStore();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header with back button */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center justify-center h-10 w-10 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors active:scale-95 -ml-2"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
        </div>
      </div>

      {/* Settings list */}
      <div className="px-4 space-y-1 mt-2">
        {/* Theme */}
        <div className="bg-surface rounded-lg">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="h-5 w-5 text-text-secondary" strokeWidth={1.5} />
              ) : (
                <Sun className="h-5 w-5 text-text-secondary" strokeWidth={1.5} />
              )}
              <span className="text-sm">{t("settings.theme")}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setTheme("dark")}
                className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                  theme === "dark"
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-surface-elevated"
                }`}
              >
                <Moon className="h-3 w-3 inline mr-1" strokeWidth={1.5} />
                {t("settings.dark")}
              </button>
              <button
                onClick={() => setTheme("light")}
                className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                  theme === "light"
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-surface-elevated"
                }`}
              >
                <Sun className="h-3 w-3 inline mr-1" strokeWidth={1.5} />
                {t("settings.light")}
              </button>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="bg-surface rounded-lg">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-text-secondary" strokeWidth={1.5} />
              <span className="text-sm">{t("settings.language")}</span>
            </div>
            <div className="flex gap-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLocale(lang.code as Locale)}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                    locale === lang.code
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:bg-surface-elevated"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications — clickable row */}
        <Link href="/settings/notifications">
          <div className="bg-surface rounded-lg flex items-center justify-between p-4 active:bg-surface-elevated cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-text-secondary" strokeWidth={1.5} />
              <div>
                <p className="text-sm">{t("settings.notifications")}</p>
                <p className="text-xs text-text-tertiary">{t("settings.enable_notifications")}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
          </div>
        </Link>

        {/* Divider */}
        <div className="h-4" />

        {/* Sign Out — visually separated, intentional placement */}
        <button
          onClick={handleSignOut}
          className="w-full bg-surface rounded-lg p-4 flex items-center gap-3 text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-sm font-medium">{t("settings.sign_out")}</span>
        </button>
      </div>
    </div>
  );
}
