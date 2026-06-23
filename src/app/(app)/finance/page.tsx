"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, TrendingUp, TrendingDown, PiggyBank, Target, BarChart3 } from "lucide-react";
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
  const totalIncome = monthTransactions.filter(t => t.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenses = monthTransactions.filter(t => t.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
  const net = totalIncome - totalExpenses;

  // Group by date
  const groupedByDate = monthTransactions.reduce((groups, txn) => {
    const date = txn.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(txn);
    return groups;
  }, {} as Record<string, typeof transactions>);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">{t("nav.finance")}</h1>
          <Link href="/finance/new">
            <Button size="sm" className="bg-accent text-white h-8 w-8 p-0">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>
        {/* Month picker — compact, full-width */}
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
        />
      </div>

      <div className="px-4 space-y-3">
        {/* Summary strip — 3 columns, compact on mobile */}
        <div className="bg-surface rounded-xl p-3">
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="flex flex-col items-center gap-0.5 px-2">
              <span className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">{t("finance.income")}</span>
              <span className="text-sm font-semibold text-success leading-none">{formatCurrency(totalIncome)}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2">
              <span className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">{t("finance.expense")}</span>
              <span className="text-sm font-semibold text-destructive leading-none">{formatCurrency(totalExpenses)}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2">
              <span className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">{t("finance.net_savings")}</span>
              <span className={`text-sm font-semibold leading-none ${net >= 0 ? "text-success" : "text-destructive"}`}>
                {net >= 0 ? "+" : ""}{formatCurrency(net)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions — 3 compact columns */}
        <div className="grid grid-cols-3 gap-2">
          <Link href="/finance/budgets">
            <div className="bg-surface rounded-xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </div>
              <p className="text-[11px] font-medium text-text-primary text-center leading-tight">{t("finance.budgets")}</p>
            </div>
          </Link>
          <Link href="/finance/goals">
            <div className="bg-surface rounded-xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </div>
              <p className="text-[11px] font-medium text-text-primary text-center leading-tight">{t("finance.savings_goals")}</p>
            </div>
          </Link>
          <Link href="/finance/review">
            <div className="bg-surface rounded-xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-accent" strokeWidth={1.5} />
              </div>
              <p className="text-[11px] font-medium text-text-primary text-center leading-tight">{t("finance.month_review")}</p>
            </div>
          </Link>
        </div>

        {/* Transactions list */}
        <div>
          <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide px-1 mb-2">{t("finance.transactions")}</p>
          <div className="bg-surface rounded-xl divide-y divide-border">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-surface-elevated rounded-lg animate-pulse" />
                ))}
              </div>
            ) : monthTransactions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-text-tertiary">{t("finance.no_transactions")}</p>
              </div>
            ) : (
              Object.entries(groupedByDate)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, txns]) => (
                  <div key={date}>
                    <p className="text-[10px] text-text-tertiary px-4 pt-3 pb-1 uppercase tracking-wide">{formatDate(date)}</p>
                    {txns.map((txn) => (
                      <Link key={txn.id} href={`/finance/${txn.id}`}>
                        <div className="flex items-center gap-3 px-4 py-2.5 active:bg-surface-elevated cursor-pointer">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            txn.type === "income" ? "bg-success/10" : "bg-destructive/10"
                          }`}>
                            {txn.type === "income" ? (
                              <TrendingUp className="h-3.5 w-3.5 text-success" strokeWidth={1.5} />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-text-primary truncate">{txn.category}</p>
                            {txn.description && (
                              <p className="text-[11px] text-text-tertiary truncate">{txn.description}</p>
                            )}
                          </div>
                          <p className={`text-xs font-semibold shrink-0 ${
                            txn.type === "income" ? "text-success" : "text-text-primary"
                          }`}>
                            {txn.type === "income" ? "+" : "-"}{formatCurrency(txn.amount)}
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