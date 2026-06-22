"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Lightbulb,
  CheckSquare,
  BookHeart,
  Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/finance", labelKey: "finance", icon: Receipt },
  { href: "/ideas", labelKey: "ideas", icon: Lightbulb },
  { href: "/tasks", labelKey: "tasks", icon: CheckSquare },
  { href: "/reflection", labelKey: "reflection", icon: BookHeart },
];

const bottomNavItems: NavItem[] = [
  { href: "/settings", labelKey: "settings", icon: Settings },
];

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
  t: ReturnType<typeof useTranslations>;
}

function NavItemComponent({ item, isActive, onClick, t }: NavItemProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
        isActive
          ? "text-accent bg-accent/10"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-r lg:border-border lg:bg-surface">
      {/* Header */}
      <div className="flex h-14 items-center px-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="relative w-[28px] h-[28px] flex-shrink-0">
            <Image
              src="/icons/android-chrome-192x192.png"
              alt="Ralts logo"
              fill
              className="object-contain"
              sizes="28px"
              priority
            />
          </div>
          <span className="font-semibold text-base text-text-primary tracking-tight">RALTS</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            onClick={onClose}
            t={t}
          />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-border px-3 py-4">
        <NavItemComponent
          item={bottomNavItems[0]}
          isActive={pathname === bottomNavItems[0].href}
          onClick={onClose}
          t={t}
        />
      </div>
    </aside>
  );
}