export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string | null;
  date: string;
  created_at: string;
}

export interface TransactionFormData {
  amount: number;
  type: TransactionType;
  category: string;
  description?: string;
  date: string;
}

export interface CategoryBudget {
  id: string;
  user_id: string;
  category: string;
  month: string;
  amount: number;
  created_at: string;
}

export interface BudgetSummary {
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
  isOverbudget: boolean;
  overbudgetReason?: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_at: string;
}

export interface SavingsGoalFormData {
  name: string;
  target_amount: number;
  deadline?: string;
}

export interface MonthReview {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  categorySummaries: BudgetSummary[];
  topExpenseCategories: { category: string; amount: number }[];
}
