"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { generateId } from "@/lib/utils";

export default function NewIdeaPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");
  const [tags, setTags] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setIsLoading(true);
    await supabase.from("ideas").insert({
      id: generateId(),
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      tech_stack: techStack ? techStack.split(",").map(s => s.trim()).filter(Boolean) : [],
      tags: tags ? tags.split(",").map(s => s.trim()).filter(Boolean) : [],
      status: "active",
    });
    setIsLoading(false);
    router.push("/ideas");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-lg font-semibold">{t("ideas.add_idea")}</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-4">
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
            type="submit"
            className="flex-1 h-10 bg-accent text-white"
            disabled={isLoading || !title.trim()}
          >
            {isLoading ? "..." : t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
