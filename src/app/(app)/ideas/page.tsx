"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, Lightbulb, Clock, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIdeasStore } from "@/stores/ideas-store";
import { formatDate } from "@/lib/utils";
import type { IdeaStatus } from "@/types";

const STATUS_FILTERS: IdeaStatus[] = ["active", "in-progress", "completed"];

export default function IdeasPage() {
  const t = useTranslations();
  const [filter, setFilter] = useState<IdeaStatus | "all">("all");
  const { ideas, isLoading, fetchIdeas } = useIdeasStore();

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const filteredIdeas = filter === "all"
    ? ideas.filter(idea => idea.status !== "archived")
    : ideas.filter(idea => idea.status === filter);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">{t("nav.ideas")}</h1>
          <Link href="/ideas/new">
            <Button size="sm" className="bg-accent text-white">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>
        {/* Filters */}
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilter("all")}
            className={`shrink-0 px-3 h-7 rounded-full text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-accent text-white"
                : "bg-surface text-text-secondary"
            }`}
          >
            {t("ideas.all_ideas")}
          </button>
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`shrink-0 px-3 h-7 rounded-full text-xs font-medium transition-colors ${
                filter === status
                  ? "bg-accent text-white"
                  : "bg-surface text-text-secondary"
              }`}
            >
              {t(`ideas.status-${status}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Ideas grid */}
      <div className="px-4 mt-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface rounded-lg h-32 animate-pulse" />
            ))}
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lightbulb className="h-10 w-10 text-text-tertiary mb-3" strokeWidth={1} />
            <p className="text-sm text-text-secondary">{t("ideas.no_ideas")}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredIdeas.map((idea) => (
              <Link key={idea.id} href={`/ideas/${idea.id}`}>
                <div className="bg-surface rounded-lg p-4 h-full active:scale-[0.99] transition-transform">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-text-primary line-clamp-2">{idea.title}</h3>
                  </div>
                  {idea.description && (
                    <p className="text-xs text-text-secondary line-clamp-2 mb-3">{idea.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      {formatDate(idea.last_activity_at)}
                    </div>
                    <Badge
                      variant={idea.status === "active" ? "accent" : "secondary"}
                      className="text-[10px] px-2 py-0.5"
                    >
                      {t(`ideas.status-${idea.status}`)}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Stale link */}
      <div className="px-4 mt-4">
        <Link href="/ideas/stale">
          <Button variant="ghost" className="w-full text-text-secondary text-sm">
            <Clock className="h-4 w-4 mr-2" strokeWidth={1.5} />
            {t("ideas.stale_ideas")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
