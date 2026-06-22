"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { BookHeart, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useReflectionStore } from "@/stores/reflection-store";

function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${startDate.toLocaleDateString("en-US", options)} – ${endDate.toLocaleDateString("en-US", options)}`;
}

export default function ReflectionPage() {
  const t = useTranslations();
  const { reflections, fetchReflections } = useReflectionStore();

  const thisWeekStart = (() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split("T")[0];
  })();

  const thisMonth = new Date().toISOString().slice(0, 7);

  // Check if current week/month already has a written reflection
  const hasCurrentWeekReflection = reflections.some(
    r => r.type === "weekly" && r.period_start === thisWeekStart && r.status === "written"
  );
  const hasCurrentMonthReflection = reflections.some(
    r => r.type === "monthly" && r.period_start.startsWith(thisMonth) && r.status === "written"
  );

  // Recent written reflections (limit to 5)
  const recentReflections = reflections
    .filter(r => r.status === "written")
    .slice(0, 5);

  useEffect(() => {
    fetchReflections();
  }, [fetchReflections]);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">{t("reflection.title")}</h1>
      </div>

      {/* Current period prompts */}
      <div className="px-4 mt-4 space-y-3">
        {/* Weekly prompt */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookHeart className="h-4 w-4 text-accent" strokeWidth={1.5} />
              {t("reflection.weekly_prompt")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-text-secondary">{t("reflection.this_week")}: {formatPeriod(thisWeekStart, new Date(new Date(thisWeekStart).getTime() + 6 * 86400000).toISOString().split("T")[0])}</p>
            {hasCurrentWeekReflection ? (
              <div className="flex items-center gap-2 text-success text-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span>Reflection written</span>
              </div>
            ) : (
              <Link href={`/reflection/weekly/${thisWeekStart}`}>
                <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  {t("reflection.write_now")}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Monthly prompt */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookHeart className="h-4 w-4 text-accent" strokeWidth={1.5} />
              {t("reflection.monthly_prompt")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-text-secondary">{t("reflection.this_month")}</p>
            {hasCurrentMonthReflection ? (
              <div className="flex items-center gap-2 text-success text-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span>Reflection written</span>
              </div>
            ) : (
              <Link href={`/reflection/monthly/${thisMonth}`}>
                <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  {t("reflection.write_now")}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Past reflections */}
        <div className="pt-2">
          <p className="text-xs font-medium text-text-secondary mb-2 px-1">{t("reflection.past_reflections")}</p>
          {recentReflections.length === 0 ? (
            <EmptyState
              icon={BookHeart}
              title={t("reflection.no_reflections")}
              description=""
            />
          ) : (
            <div className="space-y-2">
              {recentReflections.map((refl) => (
                <Link
                  key={refl.id}
                  href={refl.type === "weekly" ? `/reflection/weekly/${refl.period_start}` : `/reflection/monthly/${refl.period_start}`}
                >
                  <Card className="hover:bg-surface-elevated transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary capitalize">
                          {refl.type === "weekly" ? t("reflection.this_week") : t("reflection.this_month")}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {formatPeriod(refl.period_start, refl.period_end)} · {refl.content.slice(0, 60)}{refl.content.length > 60 ? "…" : ""}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-text-tertiary shrink-0" strokeWidth={1.5} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
