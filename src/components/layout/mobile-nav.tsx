"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Lightbulb,
  CheckSquare,
  BookHeart,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface TabItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
}

const tabs: TabItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/finance", labelKey: "finance", icon: Receipt },
  { href: "/ideas", labelKey: "ideas", icon: Lightbulb },
  { href: "/tasks", labelKey: "tasks", icon: CheckSquare },
  { href: "/reflection", labelKey: "reflection", icon: BookHeart },
];

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-surface border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-full px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] p-2 min-w-[60px] rounded-md transition-colors",
                isActive ? "text-accent" : "text-text-tertiary"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              <span>{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}