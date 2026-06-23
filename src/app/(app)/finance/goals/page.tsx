"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DatePickerField } from "@/components/ui/date-picker";
import { useFinanceStore } from "@/stores/finance-store";
import { formatCurrency } from "@/lib/utils";

export default function GoalsPage() {
  const t = useTranslations();
  const { goals, isLoading, fetchGoals, addGoal, updateGoalProgress, deleteGoal } = useFinanceStore();
  const [showForm, setShowForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: "", target_amount: "", deadline: "" });

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.name.trim() || !newGoal.target_amount) return;
    await addGoal({
      name: newGoal.name.trim(),
      target_amount: parseFloat(newGoal.target_amount),
      deadline: newGoal.deadline || undefined,
    });
    setNewGoal({ name: "", target_amount: "", deadline: "" });
    setShowForm(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => history.back()}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <h1 className="text-xl font-semibold">{t("finance.savings_goals")}</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
          {t("finance.add_goal")}
        </Button>
      </div>

      {/* Add goal form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("finance.add_goal")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal-name">Goal Name</Label>
                <Input
                  id="goal-name"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  placeholder="Emergency fund, Vacation, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-amount">Target Amount</Label>
                <Input
                  id="goal-amount"
                  type="number"
                  value={newGoal.target_amount}
                  onChange={(e) => setNewGoal({ ...newGoal, target_amount: e.target.value })}
                  placeholder="10000000"
                />
              </div>
              <div className="space-y-2">
                <DatePickerField
                  label={`${t("tasks.due_date")} (${t("common.optional")})`}
                  value={newGoal.deadline}
                  onChange={(deadline) => setNewGoal({ ...newGoal, deadline })}
                  placeholder="Select deadline"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Goals list */}
      <div className="space-y-4">
        {goals.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-text-secondary text-sm">
              No savings goals yet. Add one to start tracking!
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            const percent = goal.target_amount > 0
              ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
              : 0;
            const remaining = Math.max(goal.target_amount - goal.current_amount, 0);

            return (
              <Card key={goal.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-accent" strokeWidth={1.5} />
                      <span className="font-medium">{goal.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteGoal(goal.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      {t("common.delete")}
                    </Button>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">{formatCurrency(goal.current_amount)}</span>
                      <span className="text-text-tertiary">{formatCurrency(goal.target_amount)}</span>
                    </div>
                    <Progress value={percent} className="h-3" />
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-secondary">
                      {percent >= 100 ? "Goal reached! 🎉" : `${formatCurrency(remaining)} to go`}
                    </span>
                    <span className="font-medium text-accent">{Math.round(percent)}%</span>
                  </div>

                  {percent < 100 && (
                    <div className="mt-3 flex gap-2">
                      <Input
                        type="number"
                        placeholder="Add amount"
                        className="w-32 text-sm"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const input = e.target as HTMLInputElement;
                            const amount = parseFloat(input.value);
                            if (amount > 0) {
                              await updateGoalProgress(goal.id, goal.current_amount + amount);
                              input.value = "";
                            }
                          }
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
