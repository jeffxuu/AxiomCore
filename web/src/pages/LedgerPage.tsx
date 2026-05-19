import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTransaction,
  deleteTransaction,
  loadBaseline,
  loadTransactions,
  updateBaseline,
} from "@/api";
import { EmptyHint, PageHeader, Panel, formatCNY } from "@/components/axiom/primitives";
import type { Baseline, Transaction } from "@/types";
import { cn } from "@/lib/utils";

type TxForm = { kind: "income" | "expense"; amount: string; occurred_at: string; note: string; category: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function LedgerPage({ onStatus }: { onStatus: (status: string) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [open, setOpen] = useState(false);
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [form, setForm] = useState<TxForm>({ kind: "expense", amount: "", occurred_at: todayIso(), note: "", category: "" });
  const [baselineForm, setBaselineForm] = useState<{ starting_position: string; baseline_date: string; note: string }>({
    starting_position: "",
    baseline_date: todayIso(),
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      onStatus("Sync");
      const [{ transactions: list }, { baseline: bs }] = await Promise.all([loadTransactions(), loadBaseline()]);
      setTransactions(list);
      setBaseline(bs);
      onStatus("Live");
    } catch (exc) {
      onStatus("Sync failed");
      toast.error(exc instanceof Error ? exc.message : "Failed to load ledger");
    }
  }, [onStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitTx = async () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be > 0");
      return;
    }
    setSubmitting(true);
    try {
      await createTransaction({
        kind: form.kind,
        amount,
        occurred_at: form.occurred_at,
        note: form.note,
        category: form.category,
      });
      toast.success("Transaction recorded");
      setOpen(false);
      setForm({ kind: "expense", amount: "", occurred_at: todayIso(), note: "", category: "" });
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await deleteTransaction(id);
      toast.success("Deleted");
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Delete failed");
    }
  };

  const openBaseline = () => {
    if (baseline) {
      setBaselineForm({
        starting_position: String(baseline.starting_position),
        baseline_date: baseline.baseline_date,
        note: baseline.note,
      });
    }
    setBaselineOpen(true);
  };

  const submitBaseline = async () => {
    const sp = Number(baselineForm.starting_position);
    if (!Number.isFinite(sp)) {
      toast.error("Starting position must be a number");
      return;
    }
    setSubmitting(true);
    try {
      await updateBaseline({ starting_position: sp, baseline_date: baselineForm.baseline_date, note: baselineForm.note });
      toast.success("Baseline updated");
      setBaselineOpen(false);
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sandbox"
        title="Ledger"
        description="Every yuan in or out. The baseline at the top sets your starting net position; transactions are the diff."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={openBaseline} className="h-9 rounded-md text-[12px]">
              Edit baseline
            </Button>
            <Button onClick={() => setOpen(true)} className="h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90">
              <Plus className="size-4" />
              New transaction
            </Button>
          </div>
        }
      />

      {baseline ? (
        <Panel className="mb-6" title="Baseline" subtitle={`Set on ${baseline.baseline_date}`}>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="ax-eyebrow">Starting position</p>
              <p className={cn("ax-kpi mt-1 text-[20px] font-semibold", baseline.starting_position < 0 ? "text-[var(--danger)]" : "text-[var(--positive)]")}>
                {formatCNY(baseline.starting_position, { signed: true })} CNY
              </p>
            </div>
            {baseline.note ? <p className="max-w-md text-[12px] text-muted-foreground">{baseline.note}</p> : null}
          </div>
        </Panel>
      ) : null}

      <Panel contentClassName="px-0 py-0">
        {transactions.length === 0 ? (
          <div className="p-6">
            <EmptyHint title="No transactions yet" hint="Log an entry to start your runway." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((tx) => {
              const Icon = tx.kind === "income" ? ArrowUpRight : ArrowDownRight;
              return (
                <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      tx.kind === "income" ? "text-[var(--positive)]" : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{tx.note || (tx.kind === "income" ? "Income" : "Expense")}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {tx.occurred_at} · {tx.category || tx.kind}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "ax-kpi text-[13px] font-medium tabular",
                      tx.kind === "income" ? "text-[var(--positive)]" : "text-foreground"
                    )}
                  >
                    {tx.kind === "income" ? "+" : "−"}
                    {formatCNY(tx.amount)} CNY
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(tx.id)}
                    aria-label="Delete"
                    className="text-muted-foreground hover:text-[var(--danger)]"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* New transaction */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">New transaction</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, kind }))}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-[13px] transition-colors",
                    form.kind === kind
                      ? "border-foreground/70 bg-foreground/5 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                    {kind === "expense" ? "Outflow" : "Inflow"}
                  </span>
                  {kind === "expense" ? "Expense" : "Income"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount (CNY)</Label>
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                  className="h-9 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={form.occurred_at}
                  onChange={(e) => setForm((s) => ({ ...s, occurred_at: e.target.value }))}
                  className="h-9 rounded-md"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Note</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
                placeholder="What for?"
                className="h-9 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                placeholder="rent, freelance, ad spend…"
                className="h-9 rounded-md"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting} className="h-9 rounded-md">
              Cancel
            </Button>
            <Button onClick={submitTx} disabled={submitting} className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90">
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baseline */}
      <Dialog open={baselineOpen} onOpenChange={setBaselineOpen}>
        <DialogContent className="rounded-xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">Edit baseline</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Starting position (CNY, negative if in debt)</Label>
              <Input
                inputMode="decimal"
                value={baselineForm.starting_position}
                onChange={(e) => setBaselineForm((s) => ({ ...s, starting_position: e.target.value }))}
                placeholder="-50000"
                className="h-9 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Baseline date</Label>
              <Input
                type="date"
                value={baselineForm.baseline_date}
                onChange={(e) => setBaselineForm((s) => ({ ...s, baseline_date: e.target.value }))}
                className="h-9 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Note</Label>
              <Input
                value={baselineForm.note}
                onChange={(e) => setBaselineForm((s) => ({ ...s, note: e.target.value }))}
                placeholder="Why this baseline?"
                className="h-9 rounded-md"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBaselineOpen(false)} disabled={submitting} className="h-9 rounded-md">
              Cancel
            </Button>
            <Button onClick={submitBaseline} disabled={submitting} className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90">
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
