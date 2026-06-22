export type Theme = "dark" | "light";
export type Locale = "en" | "id" | "zh";

export interface Profile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  theme: Theme;
  locale: Locale;
  push_subscription: PushSubscription | null;
}

export interface User {
  id: string;
  email: string;
}
