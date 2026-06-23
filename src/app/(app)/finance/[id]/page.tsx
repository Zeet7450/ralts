"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinanceStore } from "@/stores/finance-store";
import { formatCurrency } from "@/lib/utils";

export default function TransactionDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const { transactions, fetchTransactions, updateTransaction, deleteTransaction } = useFinanceStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    category: "",
    description: "",
    date: "",
  });

  const txnId = params.id as string;

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const txn = transactions.find((txn) => txn.id === txnId);
    if (txn) {
      setFormData({
        type: txn.type,
        amount: String(txn.amount),
        category: txn.category,
        description: txn.description || "",
        date: txn.date,
      });
    }
  }, [transactions, txnId]);

  const txn = transactions.find((txn) => txn.id === txnId);

  const handleSave = async () => {
    if (!formData.amount || !formData.category) return;
    setIsLoading(true);
    await updateTransaction(txnId, {
      amount: parseFloat(formData.amount),
      type: formData.type,
      category: formData.category,
      description: formData.description || null,
      date: formData.date,
    });
    setIsLoading(false);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsLoading(true);
    await deleteTransaction(txnId);
    setIsLoading(false);
    router.push("/finance");
  };

  if (!txn && transactions.length > 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary">Transaction not found</p>
        <Button variant="outline" onClick={() => router.push("/finance")}>
          Back to Finance
        </Button>
      </div>
    );
  }

  // Read-only view
  if (txn && !isEditing) {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-2 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <h1 className="text-lg font-semibold flex-1">{t("finance.transaction_detail")}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEditing(true)}
            className="h-9 w-9"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>

        {/* Transaction display */}
        <div className="px-4 pt-4 space-y-4">
          {/* Amount card */}
          <div className="bg-surface rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                txn.type === "income" ? "bg-success/10" : "bg-destructive/10"
              }`}>
                {txn.type === "income" ? (
                  <TrendingUp className="h-5 w-5 text-success" strokeWidth={1.5} />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" strokeWidth={1.5} />
                )}
              </div>
              <div>
                <p className="text-xs text-text-tertiary capitalize">{txn.type}</p>
                <p className={`text-2xl font-semibold ${
                  txn.type === "income" ? "text-success" : "text-text-primary"
                }`}>
                  {txn.type === "income" ? "+" : "-"}{formatCurrency(txn.amount)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-text-tertiary">Category</span>
                <span className="text-sm text-text-primary">{txn.category}</span>
              </div>
              {txn.description && (
                <div className="flex justify-between">
                  <span className="text-xs text-text-tertiary">Description</span>
                  <span className="text-sm text-text-primary text-right max-w-[200px]">{txn.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-text-tertiary">Date</span>
                <span className="text-sm text-text-primary">{txn.date}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-surface w-full max-w-sm rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold">{t("common.confirm_delete")}</h2>
              <p className="text-sm text-text-secondary">
                Are you sure you want to delete this transaction? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  className="flex-1 h-10 bg-destructive text-white hover:bg-destructive/90"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-2 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => isEditing ? setIsEditing(false) : router.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-lg font-semibold flex-1">Edit Transaction</h1>
      </div>

      {/* Edit form */}
      <div className="px-4 pt-4 space-y-4">
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

        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs font-medium text-text-secondary">{t("finance.amount")}</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
            placeholder="0"
            className="h-11 bg-surface border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-xs font-medium text-text-secondary">{t("finance.category")}</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
            placeholder="Food, Transport, Salary..."
            className="h-11 bg-surface border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-medium text-text-secondary">{t("finance.description")}</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t("common.optional")}
            className="h-11 bg-surface border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date" className="text-xs font-medium text-text-secondary">{t("finance.date")}</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            className="h-11 bg-surface border-border"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-10"
            onClick={() => setIsEditing(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 h-10 bg-accent text-white"
            disabled={isLoading || !formData.amount || !formData.category}
          >
            {isLoading ? "..." : t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}