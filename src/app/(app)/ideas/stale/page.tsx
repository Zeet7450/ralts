"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Lightbulb } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StaleIdeasPage() {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-xl font-semibold">{t("ideas.stale_ideas")}</h1>
      </div>

      <EmptyState
        icon={Lightbulb}
        title={t("ideas.no_ideas")}
        description=""
      />
    </div>
  );
}
