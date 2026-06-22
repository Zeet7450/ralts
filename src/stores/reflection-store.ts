import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Reflection, ReflectionType } from "@/types";
import { generateId } from "@/lib/utils";

interface ReflectionState {
  reflections: Reflection[];
  isLoading: boolean;
  error: string | null;
  fetchReflections: () => Promise<void>;
  writeReflection: (type: ReflectionType, periodStart: string, periodEnd: string, content: string) => Promise<void>;
  skipReflection: (type: ReflectionType, periodStart: string, periodEnd: string) => Promise<void>;
}

export const useReflectionStore = create<ReflectionState>((set, get) => ({
  reflections: [],
  isLoading: false,
  error: null,

  fetchReflections: async () => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("reflections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ reflections: data || [], isLoading: false });
    }
  },

  writeReflection: async (type, periodStart, periodEnd, content) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("reflections").insert({
      id: generateId(),
      user_id: user.id,
      type,
      period_start: periodStart,
      period_end: periodEnd,
      content,
      status: "written",
    });

    await get().fetchReflections();
  },

  skipReflection: async (type, periodStart, periodEnd) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("reflections").insert({
      id: generateId(),
      user_id: user.id,
      type,
      period_start: periodStart,
      period_end: periodEnd,
      content: "",
      status: "skipped",
    });

    await get().fetchReflections();
  },
}));
