"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, TrendingUp, TrendingDown, PiggyBank, Target, BarChart3, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinanceStore } from "@/stores/finance-store";
import { formatCurrency, formatDate, getMonthString } from "@/lib/utils";

export default function FinancePage() {
  const t = useTranslations();
  const [selectedMonth, setSelectedMonth] = useState(getMonthString());
  const { transactions, isLoading, fetchTransactions } = useFinanceStore();

  useEffect(() => {
    fetchTransactions(selectedMonth);
  }, [selectedMonth, fetchTransactions]);

  const monthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
  const totalIncome = monthTransactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = monthTransactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const net = totalIncome - totalExpenses;

  // Group by date
  const groupedByDate = monthTransactions.reduce((groups, transaction) => {
    const date = transaction.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, typeof transactions>);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">{t("nav.finance")}</h1>
          <Link href="/finance/new">
            <Button size="sm" className="bg-accent text-white">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full h-9 rounded-md border border-border bg-surface px-3 text-sm"
        />
      </div>

      <div className="px-4 space-y-4 mt-4">
        {/* Summary row */}
        <div className="bg-surface rounded-lg p-4">
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="text-center pl-2">
              <p className="text-xs text-text-secondary mb-1">{t("finance.income")}</p>
              <p className="text-sm font-semibold text-success">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="text-center px-3">
              <p className="text-xs text-text-secondary mb-1">{t("finance.expense")}</p>
              <p className="text-sm font-semibold text-destructive">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="text-center pr-2">
              <p className="text-xs text-text-secondary mb-1">{t("finance.net_savings")}</p>
              <p className={`text-sm font-semibold ${net >= 0 ? "text-success" : "text-destructive"}`}>
                {net >= 0 ? "+" : ""}{formatCurrency(net)}
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <Link href="/finance/budgets" className="flex-1">
            <div className="bg-surface rounded-lg p-3 flex items-center gap-2 group cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary">{t("finance.budgets")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
            </div>
          </Link>
          <Link href="/finance/goals" className="flex-1">
            <div className="bg-surface rounded-lg p-3 flex items-center gap-2 group cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary">{t("finance.savings_goals")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
            </div>
          </Link>
          <Link href="/finance/review" className="flex-1">
            <div className="bg-surface rounded-lg p-3 flex items-center gap-2 group cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary">{t("finance.month_review")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
            </div>
          </Link>
        </div>

        {/* Transactions */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2 px-1">{t("finance.transactions")}</p>
          <div className="bg-surface rounded-lg divide-y divide-border">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-surface-elevated rounded animate-pulse" />
                ))}
              </div>
            ) : monthTransactions.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-text-tertiary">{t("finance.no_transactions")}</p>
              </div>
            ) : (
              Object.entries(groupedByDate)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, txns]) => (
                  <div key={date}>
                    <p className="text-[11px] text-text-tertiary px-4 pt-3 pb-1">{formatDate(date)}</p>
                    {txns.map((txn) => (
                      <Link key={txn.id} href={`/finance/${txn.id}`}>
                        <div className="flex items-center gap-3 px-4 py-3 active:bg-surface-elevated cursor-pointer">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            txn.type === "income" ? "bg-success/10" : "bg-destructive/10"
                          }`}>
                            {txn.type === "income" ? (
                              <TrendingUp className="h-4 w-4 text-success" strokeWidth={1.5} />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary truncate">{txn.category}</p>
                            {txn.description && (
                              <p className="text-xs text-text-tertiary truncate">{txn.description}</p>
                            )}
                          </div>
                          <p className={`text-sm font-medium shrink-0 ${
                            txn.type === "income" ? "text-success" : "text-text-primary"
                          }`}>
                            {txn.type === "income" ? "+" : ""}{formatCurrency(txn.amount)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
