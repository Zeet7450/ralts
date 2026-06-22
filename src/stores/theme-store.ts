import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "@/types";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => {
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const newTheme = get().theme === "dark" ? "light" : "dark";
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(newTheme);
        set({ theme: newTheme });
      },
    }),
    { name: "ralts-theme" }
  )
);
