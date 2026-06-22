"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { generateId } from "@/lib/utils";

export default function MonthlyReflectionPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuthStore();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);

  const monthStr = params.date as string;
  const [year, month] = monthStr.split("-");
  const periodStart = `${monthStr}-01`;
  const periodEnd = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

  const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reflections")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "monthly")
      .eq("period_start", periodStart)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setContent(data.content || "");
          setExistingId(data.id);
        }
      });
  }, [user, periodStart, supabase]);

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);

    if (existingId) {
      await supabase.from("reflections").update({ content, status: "written" }).eq("id", existingId);
    } else {
      await supabase.from("reflections").insert({
        id: generateId(),
        user_id: user.id,
        type: "monthly",
        period_start: periodStart,
        period_end: periodEnd,
        content,
        status: "written",
      });
    }

    setIsLoading(false);
    router.push("/reflection");
  };

  const handleSkip = async () => {
    if (!user) return;
    if (existingId) {
      await supabase.from("reflections").update({ status: "skipped" }).eq("id", existingId);
    } else {
      await supabase.from("reflections").insert({
        id: generateId(),
        user_id: user.id,
        type: "monthly",
        period_start: periodStart,
        period_end: periodEnd,
        content: "",
        status: "skipped",
      });
    }
    router.push("/reflection");
  };

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{t("reflection.monthly_prompt")}</h1>
          <p className="text-xs text-text-secondary mt-0.5">{monthName}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("reflection.write_reflection")}
            rows={10}
            className="min-h-[200px]"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleSkip}>{t("reflection.skip")}</Button>
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleSave}
              disabled={isLoading || !content.trim()}
            >
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
