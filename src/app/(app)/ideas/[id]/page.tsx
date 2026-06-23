"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useIdeasStore } from "@/stores/ideas-store";
import type { Idea } from "@/types";

export default function IdeaDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const { ideas, fetchIdeas, updateIdea, deleteIdea } = useIdeasStore();

  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<Idea["status"]>("active");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const ideaId = params.id as string;

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  useEffect(() => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (idea) {
      setTitle(idea.title);
      setDescription(idea.description || "");
      setTechStack(Array.isArray(idea.tech_stack) ? idea.tech_stack.join(", ") : "");
      setTags(Array.isArray(idea.tags) ? idea.tags.join(", ") : "");
      setStatus(idea.status);
    }
  }, [ideas, ideaId]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsLoading(true);
    await updateIdea(ideaId, {
      title: title.trim(),
      description: description.trim() || undefined,
      tech_stack: techStack ? techStack.split(",").map((s) => s.trim()).filter(Boolean) : [],
      tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      status,
    });
    setIsLoading(false);
    router.push("/ideas");
  };

  const handleDelete = async () => {
    setIsLoading(true);
    await deleteIdea(ideaId);
    setIsLoading(false);
    router.push("/ideas");
  };

  if (!ideas.find((i) => i.id === ideaId) && ideas.length > 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary">Idea not found</p>
        <Button variant="outline" onClick={() => router.push("/ideas")}>
          Back to Ideas
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-2 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-lg font-semibold flex-1">{t("ideas.edit_idea")}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowDeleteConfirm(true)}
          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Form */}
      <div className="px-4 pt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-xs font-medium text-text-secondary">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="My awesome idea"
            className="h-11 bg-surface border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-medium text-text-secondary">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("common.optional")}
            rows={4}
            className="bg-surface border-border resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tech_stack" className="text-xs font-medium text-text-secondary">Tech stack</Label>
          <Input
            id="tech_stack"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            placeholder="React, Node.js, PostgreSQL"
            className="h-11 bg-surface border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tags" className="text-xs font-medium text-text-secondary">Tags</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="web, mobile, api"
            className="h-11 bg-surface border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status" className="text-xs font-medium text-text-secondary">Status</Label>
          <div className="flex gap-2">
            {(["active", "in-progress", "completed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`h-9 px-3 rounded-md text-xs font-medium transition-colors ${
                  status === s
                    ? "bg-accent text-white"
                    : "bg-surface text-text-secondary hover:bg-surface-elevated"
                }`}
              >
                {t(`ideas.status-${s}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-10"
            onClick={() => router.back()}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 h-10 bg-accent text-white"
            disabled={isLoading || !title.trim()}
          >
            {isLoading ? "..." : t("common.save")}
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold">{t("common.confirm_delete")}</h2>
            <p className="text-sm text-text-secondary">
              Are you sure you want to delete this idea? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="flex-1 h-10 bg-destructive text-white hover:bg-destructive/90"
                onClick={handleDelete}
                disabled={isLoading}
              >
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}