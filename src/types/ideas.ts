export type IdeaStatus = "active" | "in-progress" | "completed" | "archived";

export interface Idea {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  tech_stack: string[];
  tags: string[];
  status: IdeaStatus;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface IdeaFormData {
  title: string;
  description?: string;
  tech_stack?: string[];
  tags?: string[];
  status?: IdeaStatus;
}
