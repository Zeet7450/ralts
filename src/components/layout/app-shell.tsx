"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title = "RALTS" }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Top Bar */}
      <TopBar title={title} />

      {/* Main Content */}
      <main className="lg:pl-60 pb-20 lg:pb-0">
        <div className="pt-14 lg:pt-0">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
