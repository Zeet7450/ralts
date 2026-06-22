"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IdeaDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();

  return (
    <div className="p-6 space-y-6 max-w-md">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-xl font-semibold">{t("ideas.edit_idea")}</h1>
      </div>
      <p className="text-text-secondary">Idea ID: {params.id}</p>
    </div>
  );
}
