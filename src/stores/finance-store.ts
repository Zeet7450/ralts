import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, CategoryBudget, SavingsGoal, TransactionFormData, BudgetSummary } from "@/types";
import { generateId } from "@/lib/utils";

interface FinanceState {
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  isLoading: boolean;
  error: string | null;
  fetchTransactions: (month?: string) => Promise<void>;
  addTransaction: (data: TransactionFormData) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  fetchBudgets: (month: string) => Promise<void>;
  setBudget: (category: string, month: string, amount: number) => Promise<void>;
  fetchGoals: () => Promise<void>;
  addGoal: (data: { name: string; target_amount: number; deadline?: string }) => Promise<void>;
  updateGoalProgress: (id: string, current_amount: number) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  getBudgetSummaries: (month: string) => BudgetSummary[];
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  budgets: [],
  goals: [],
  isLoading: false,
  error: null,

  fetchTransactions: async (month?: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    let query = supabase.from("transactions").select("*").order("date", { ascending: false });

    if (month) {
      query = query.gte("date", `${month}-01`).lt("date", `${month}-32`);
    }

    const { data, error } = await query;
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ transactions: data || [], isLoading: false });
    }
  },

  addTransaction: async (data) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("transactions").insert({
      id: generateId(),
      user_id: user.id,
      ...data,
    });

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      await get().fetchTransactions();
    }
  },

  updateTransaction: async (id, data) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    const { error } = await supabase.from("transactions").update(data).eq("id", id);

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      await get().fetchTransactions();
    }
  },

  deleteTransaction: async (id) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      await get().fetchTransactions();
    }
  },

  fetchBudgets: async (month) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("category_budgets")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", month);

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ budgets: data || [], isLoading: false });
    }
  },

  setBudget: async (category, month, amount) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("category_budgets").upsert({
      user_id: user.id,
      category,
      month,
      amount,
    }, {
      onConflict: "user_id,category,month",
    });

    if (!error) {
      await get().fetchBudgets(month);
    }
  },

  fetchGoals: async () => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ goals: data || [], isLoading: false });
    }
  },

  addGoal: async (data) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("savings_goals").insert({
      id: generateId(),
      user_id: user.id,
      ...data,
      current_amount: 0,
    });

    await get().fetchGoals();
  },

  updateGoalProgress: async (id, current_amount) => {
    const supabase = createClient();
    await supabase.from("savings_goals").update({ current_amount }).eq("id", id);
    await get().fetchGoals();
  },

  deleteGoal: async (id) => {
    const supabase = createClient();
    await supabase.from("savings_goals").delete().eq("id", id);
    await get().fetchGoals();
  },

  getBudgetSummaries: (month) => {
    const { transactions, budgets } = get();
    const monthExpenses = transactions.filter(
      t => t.type === "expense" && t.date.startsWith(month)
    );

    const summaries: BudgetSummary[] = budgets
      .filter(b => b.month === month)
      .map(budget => {
        const spent = monthExpenses
          .filter(t => t.category === budget.category)
          .reduce((sum, t) => sum + t.amount, 0);
        const remaining = budget.amount - spent;
        const isOverbudget = spent > budget.amount;

        let overbudgetReason: string | undefined;
        if (isOverbudget) {
          const excess = spent - budget.amount;
          const percentOver = Math.round((excess / budget.amount) * 100);
          overbudgetReason = `Exceeded by ${percentOver}% (${formatCurrency(excess)})`;
        }

        return {
          category: budget.category,
          budgeted: budget.amount,
          spent,
          remaining,
          isOverbudget,
          overbudgetReason,
        };
      });

    return summaries;
  },
}));

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
