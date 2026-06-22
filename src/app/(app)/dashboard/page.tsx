"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Receipt, Lightbulb, CheckSquare, BookHeart, TrendingUp, CircleCheck, ArrowUpRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useFinanceStore } from "@/stores/finance-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useIdeasStore } from "@/stores/ideas-store";
import { useEffect } from "react";

interface ActivityItem {
  id: string;
  module: "finance" | "tasks" | "ideas" | "reflection";
  action: string;
  description: string;
  createdAt: string; // ISO date string for sorting
  timeLabel: string; // human-readable relative time
  href: string;
  icon: React.ReactNode;
  iconBg: string;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

export default function DashboardPage() {
  const t = useTranslations();
  const { user } = useAuthStore();
  const { transactions, fetchTransactions } = useFinanceStore();
  const { tasks, fetchTasks } = useTasksStore();
  const { ideas, fetchIdeas } = useIdeasStore();

  useEffect(() => {
    fetchTransactions();
    fetchTasks();
    fetchIdeas();
  }, [fetchTransactions, fetchTasks, fetchIdeas]);

  // Build activity from real data, sorted by recency
  const allActivity: ActivityItem[] = [];

  transactions.forEach((tx) => {
    const isIncome = tx.type === "income";
    allActivity.push({
      id: `tx-${tx.id}`,
      module: "finance",
      action: isIncome ? "added income" : "added expense",
      description: `${tx.category} · ${formatCurrency(tx.amount)}`,
      createdAt: tx.created_at,
      timeLabel: timeAgo(tx.created_at),
      href: "/finance",
      icon: isIncome
        ? <TrendingUp className="h-4 w-4 text-success" strokeWidth={1.5} />
        : <Receipt className="h-4 w-4 text-destructive" strokeWidth={1.5} />,
      iconBg: "bg-surface-elevated",
    });
  });

  tasks.forEach((task) => {
    allActivity.push({
      id: `task-${task.id}`,
      module: "tasks",
      action: task.is_completed ? "completed task" : "created task",
      description: task.title,
      createdAt: task.is_completed && task.completed_at ? task.completed_at : task.created_at,
      timeLabel: timeAgo(task.is_completed && task.completed_at ? task.completed_at : task.created_at),
      href: "/tasks",
      icon: task.is_completed
        ? <CircleCheck className="h-4 w-4 text-success" strokeWidth={1.5} />
        : <CheckSquare className="h-4 w-4 text-accent" strokeWidth={1.5} />,
      iconBg: "bg-surface-elevated",
    });
  });

  ideas.forEach((idea) => {
    allActivity.push({
      id: `idea-${idea.id}`,
      module: "ideas",
      action: "captured idea",
      description: idea.title,
      createdAt: idea.created_at,
      timeLabel: timeAgo(idea.created_at),
      href: "/ideas",
      icon: <Lightbulb className="h-4 w-4 text-accent" strokeWidth={1.5} />,
      iconBg: "bg-surface-elevated",
    });
  });

  // Sort by recency
  allActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recent = allActivity.slice(0, 6);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">{t("dashboard.welcome")}</h1>
        <p className="text-sm text-text-secondary mt-0.5">{user?.email}</p>
      </div>

      {/* Module shortcuts */}
      <div className="px-4 mt-3">
        <div className="flex gap-2">
          {[
            { href: "/finance", label: t("nav.finance"), icon: <Receipt className="h-5 w-5" strokeWidth={1.5} /> },
            { href: "/ideas", label: t("nav.ideas"), icon: <Lightbulb className="h-5 w-5" strokeWidth={1.5} /> },
            { href: "/tasks", label: t("nav.tasks"), icon: <CheckSquare className="h-5 w-5" strokeWidth={1.5} /> },
            { href: "/reflection", label: t("nav.reflection"), icon: <BookHeart className="h-5 w-5" strokeWidth={1.5} /> },
          ].map(({ href, label, icon }) => (
            <Link key={href} href={href} className="flex-1">
              <div className="bg-surface rounded-xl p-3 flex flex-col items-center gap-1.5 text-center active:scale-[0.98] transition-transform cursor-pointer">
                <div className="text-accent">{icon}</div>
                <span className="text-xs font-medium text-text-primary">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 mt-6">
        <p className="text-xs font-medium text-text-secondary mb-2 px-1">Recent</p>
        <div className="bg-surface rounded-xl divide-y divide-border">
          {recent.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-text-tertiary">No activity yet. Start by adding a transaction or task.</p>
            </div>
          ) : (
            recent.map((item) => (
              <Link key={item.id} href={item.href}>
                <div className="flex items-center gap-3 px-4 py-3 active:bg-surface-elevated transition-colors cursor-pointer">
                  <div className={`w-7 h-7 rounded-full ${item.iconBg} flex items-center justify-center shrink-0`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{item.action}</p>
                    <p className="text-xs text-text-secondary truncate">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] text-text-tertiary whitespace-nowrap">{item.timeLabel}</span>
                    <ArrowUpRight className="h-3 w-3 text-text-tertiary" strokeWidth={1.5} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
