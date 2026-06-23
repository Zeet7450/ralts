"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MonthPicker } from "@/components/ui/month-picker";
import { useFinanceStore } from "@/stores/finance-store";
import { formatCurrency, getMonthString } from "@/lib/utils";

export default function BudgetsPage() {
  const t = useTranslations();
  const [selectedMonth, setSelectedMonth] = useState(getMonthString());
  const [newBudgetCategory, setNewBudgetCategory] = useState("");
  const [newBudgetAmount, setNewBudgetAmount] = useState("");
  const { budgets, isLoading, fetchBudgets, setBudget, getBudgetSummaries } = useFinanceStore();

  useEffect(() => {
    fetchBudgets(selectedMonth);
  }, [selectedMonth, fetchBudgets]);

  const summaries = getBudgetSummaries(selectedMonth);
  const monthExpenses = summaries.reduce((sum, s) => sum + s.spent, 0);

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudgetCategory.trim() || !newBudgetAmount) return;
    await setBudget(newBudgetCategory.trim(), selectedMonth, parseFloat(newBudgetAmount));
    setNewBudgetCategory("");
    setNewBudgetAmount("");
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => history.back()}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-xl font-semibold">{t("finance.budgets")}</h1>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-4">
        <div className="w-48">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
        <div className="text-sm text-text-secondary">
          Total spent: <span className="font-medium text-text-primary">{formatCurrency(monthExpenses)}</span>
        </div>
      </div>

      {/* Add budget form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("finance.set_budget")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddBudget} className="flex gap-2">
            <Input
              placeholder="Category (e.g., Food, Transport)"
              value={newBudgetCategory}
              onChange={(e) => setNewBudgetCategory(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Amount"
              value={newBudgetAmount}
              onChange={(e) => setNewBudgetAmount(e.target.value)}
              className="w-32"
            />
            <Button type="submit" size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Budget list */}
      <div className="space-y-3">
        {summaries.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-text-secondary text-sm">
              No budgets set for {selectedMonth}
            </CardContent>
          </Card>
        ) : (
          summaries.map((summary) => {
            const percent = summary.budgeted > 0 ? Math.min((summary.spent / summary.budgeted) * 100, 100) : 0;
            return (
              <Card key={summary.category}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{summary.category}</span>
                      {summary.isOverbudget && (
                        <Badge variant="destructive" className="text-xs">{t("finance.overbudget")}</Badge>
                      )}
                    </div>
                    <span className="text-sm text-text-secondary">
                      {formatCurrency(summary.spent)} / {formatCurrency(summary.budgeted)}
                    </span>
                  </div>
                  <Progress
                    value={percent}
                    className="h-2"
                  />
                  <div className="flex justify-between mt-1 text-xs text-text-tertiary">
                    <span>
                      {summary.isOverbudget
                        ? summary.overbudgetReason
                        : `${formatCurrency(summary.remaining)} ${t("finance.remaining")}`}
                    </span>
                    <span>{Math.round(percent)}%</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
