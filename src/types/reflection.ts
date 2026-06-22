export type ReflectionType = "weekly" | "monthly";
export type ReflectionStatus = "skipped" | "reminded" | "written";

export interface Reflection {
  id: string;
  user_id: string;
  type: ReflectionType;
  period_start: string;
  period_end: string;
  content: string;
  status: ReflectionStatus;
  created_at: string;
}

export interface ReflectionPrompt {
  type: ReflectionType;
  title: string;
  questions: string[];
  context_hints?: {
    finance_hint?: string;
    tasks_hint?: string;
  };
}

export interface WeeklyPrompt extends ReflectionPrompt {
  type: "weekly";
  week_start: string;
  week_end: string;
}

export interface MonthlyPrompt extends ReflectionPrompt {
  type: "monthly";
  month: string;
}
