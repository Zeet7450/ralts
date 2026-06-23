"use client";

import * as React from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const t = useTranslations("nav");

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-surface border-b border-border px-4 safe-area-pt">
      <div className="flex items-center justify-between h-full">
        {/* Left side — clean title */}
        <h1 className="font-semibold text-base text-text-primary truncate max-w-[140px] sm:max-w-[200px]">{title}</h1>

        {/* Right side — settings only */}
        <Link
          href="/settings"
          className="flex items-center justify-center h-10 w-10 rounded-md text-text-secondary hover:text-accent hover:bg-surface-elevated transition-colors active:scale-95"
        >
          <Settings className="h-5 w-5" strokeWidth={1.5} />
          <span className="sr-only">{t("settings")}</span>
        </Link>
      </div>
    </header>
  );
}
