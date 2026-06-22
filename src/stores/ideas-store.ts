import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Idea, IdeaFormData } from "@/types";
import { generateId } from "@/lib/utils";

interface IdeasState {
  ideas: Idea[];
  isLoading: boolean;
  error: string | null;
  staleIdeas: Idea[];
  fetchIdeas: () => Promise<void>;
  addIdea: (data: IdeaFormData) => Promise<void>;
  updateIdea: (id: string, data: Partial<IdeaFormData>) => Promise<void>;
  archiveIdea: (id: string) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  getStaleIdeas: () => Idea[];
}

export const useIdeasStore = create<IdeasState>((set, get) => ({
  ideas: [],
  isLoading: false,
  error: null,
  staleIdeas: [],

  fetchIdeas: async () => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("ideas")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ ideas: data || [], isLoading: false });
    }
  },

  addIdea: async (data) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("ideas").insert({
      id: generateId(),
      user_id: user.id,
      ...data,
      status: data.status || "active",
      tech_stack: data.tech_stack || [],
      tags: data.tags || [],
    });

    await get().fetchIdeas();
  },

  updateIdea: async (id, data) => {
    const supabase = createClient();
    const { error } = await supabase.from("ideas").update({
      ...data,
      last_activity_at: new Date().toISOString(),
    }).eq("id", id);

    if (!error) {
      await get().fetchIdeas();
    }
  },

  archiveIdea: async (id) => {
    await get().updateIdea(id, { status: "archived" });
  },

  deleteIdea: async (id) => {
    const supabase = createClient();
    await supabase.from("ideas").delete().eq("id", id);
    await get().fetchIdeas();
  },

  getStaleIdeas: () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return get().ideas.filter(idea =>
      idea.status !== "archived" &&
      idea.status !== "completed" &&
      new Date(idea.last_activity_at) < thirtyDaysAgo
    );
  },
}));
