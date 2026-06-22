"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeSettingsPage() {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-xl font-semibold">{t("settings.theme")}</h1>
      </div>
    </div>
  );
}
