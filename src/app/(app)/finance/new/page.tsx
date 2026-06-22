"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { generateId } from "@/lib/utils";

export default function NewTransactionPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    category: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    const { error } = await supabase.from("transactions").insert({
      id: generateId(),
      user_id: user.id,
      amount: parseFloat(formData.amount),
      type: formData.type,
      category: formData.category,
      description: formData.description || null,
      date: formData.date,
    });

    if (!error) {
      router.push("/finance");
    }
    setIsLoading(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-md">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-xl font-semibold">{t("finance.add_transaction")}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.type === "expense" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, type: "expense" })}
                className={formData.type === "expense" ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}
              >
                {t("finance.expense")}
              </Button>
              <Button
                type="button"
                variant={formData.type === "income" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, type: "income" })}
                className={formData.type === "income" ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}
              >
                {t("finance.income")}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t("finance.amount")}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t("finance.category")}</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                placeholder="Food, Transport, Salary..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("finance.description")}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("common.optional")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">{t("finance.date")}</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                disabled={isLoading}
              >
                {isLoading ? "..." : t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
