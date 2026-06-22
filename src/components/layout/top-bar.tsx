"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const t = useTranslations("nav");

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-surface border-b border-border px-4 safe-area-pt">
      <div className="flex items-center justify-between h-full">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 min-w-10 min-h-10">
                <Menu className="h-5 w-5" strokeWidth={1.5} />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>
          <h1 className="font-semibold text-base text-text-primary truncate max-w-[100px] sm:max-w-[160px]">{title}</h1>
        </div>

        {/* Right side */}
        <Link
          href="/settings"
          className="flex items-center justify-center h-10 w-10 min-w-10 min-h-10 rounded-md text-text-secondary hover:text-accent hover:bg-surface-elevated transition-colors"
        >
          <Settings className="h-5 w-5" strokeWidth={1.5} />
          <span className="sr-only">{t("settings")}</span>
        </Link>
      </div>
    </header>
  );
}
