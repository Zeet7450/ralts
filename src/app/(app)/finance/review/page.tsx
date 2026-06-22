"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useFinanceStore } from "@/stores/finance-store";
import { formatCurrency, getMonthString } from "@/lib/utils";

export default function ReviewPage() {
  const t = useTranslations();
  const [selectedMonth, setSelectedMonth] = useState(getMonthString());
  const { transactions, isLoading, fetchTransactions } = useFinanceStore();

  useEffect(() => {
    fetchTransactions(selectedMonth);
  }, [selectedMonth, fetchTransactions]);

  const monthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
  const totalIncome = monthTransactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = monthTransactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Top expense categories
  const categoryTotals = monthTransactions
    .filter(t => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxCategoryAmount = topCategories[0]?.[1] || 1;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => history.back()}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-xl font-semibold">{t("finance.month_review")}</h1>
      </div>

      {/* Month selector */}
      <input
        type="month"
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        className="px-3 py-2 rounded-md border border-border bg-surface text-sm"
      />

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-text-secondary mb-1">{t("finance.month_income")}</p>
            <p className="text-xl font-semibold text-success">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-text-secondary mb-1">{t("finance.month_expenses")}</p>
            <p className="text-xl font-semibold text-destructive">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-text-secondary mb-1">{t("finance.net_savings")}</p>
            <p className={`text-xl font-semibold ${netSavings >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(netSavings)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Savings rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Savings Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={Math.max(0, Math.min(savingsRate, 100))} className="h-3 flex-1" />
            <span className={`font-semibold ${savingsRate >= 0 ? "text-success" : "text-destructive"}`}>
              {Math.round(savingsRate)}%
            </span>
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            {savingsRate >= 20 ? "Great savings rate! 🎉" : savingsRate >= 0 ? "Keep it up!" : "Expenses exceed income"}
          </p>
        </CardContent>
      </Card>

      {/* Top categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("finance.top_categories")}</CardTitle>
        </CardHeader>
        <CardContent>
          {topCategories.length === 0 ? (
            <p className="text-text-secondary text-sm">No expense data for this month</p>
          ) : (
            <div className="space-y-3">
              {topCategories.map(([category, amount]) => {
                const percent = (amount / maxCategoryAmount) * 100;
                return (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{category}</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction count */}
      <Card>
        <CardContent className="pt-4 text-center">
          <p className="text-3xl font-semibold text-accent">{monthTransactions.length}</p>
          <p className="text-sm text-text-secondary">transactions this month</p>
        </CardContent>
      </Card>
    </div>
  );
}
