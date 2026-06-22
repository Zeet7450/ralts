"use client";

import { useTranslations } from "next-intl";
import { Moon, Sun, Globe, Bell, LogOut, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
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

        {/* Notifications */}
        <div className="bg-surface rounded-lg">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-text-secondary" strokeWidth={1.5} />
              <div>
                <p className="text-sm">{t("settings.notifications")}</p>
                <p className="text-xs text-text-tertiary">{t("settings.enable_notifications")}</p>
              </div>
            </div>
            <Switch />
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full bg-surface rounded-lg p-4 flex items-center gap-3 text-destructive hover:bg-surface-elevated transition-colors"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-sm font-medium">{t("settings.sign_out")}</span>
        </button>
      </div>
    </div>
  );
}
