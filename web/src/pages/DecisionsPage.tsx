import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createDecision, deleteDecision, loadDecisions, updateDecision, type DecisionInput } from "@/api";
import { EmptyHint, PageHeader, Panel, formatCNY as _formatCNY } from "@/components/axiom/primitives";
import type { Decision, DecisionStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: DecisionStatus[] = ["open", "committed", "reviewed"];
const STATUS_TONE: Record<DecisionStatus, string> = {
  open: "ax-status-warning",
  committed: "ax-status-info",
  reviewed: "ax-status-positive",
};

const EMPTY_FORM: DecisionInput & { reviewed_outcome?: string } = {
  context: "",
  options: [],
  choice: "",
  rationale: "",
  expected_outcome: "",
  status: "open",
};

void _formatCNY;

export function DecisionsPage({ onStatus }: { onStatus: (status: string) => void }) {
  const [items, setItems] = useState<Decision[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Decision | null>(null);
  const [form, setForm] = useState<DecisionInput & { reviewed_outcome?: string }>(EMPTY_FORM);
  const [optionsInput, setOptionsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      onStatus("Sync");
      const { decisions } = await loadDecisions();
      setItems(decisions);
      onStatus("Live");
    } catch (exc) {
      onStatus("Sync failed");
      toast.error(exc instanceof Error ? exc.message : "Failed to load decisions");
    }
  }, [onStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOptionsInput("");
    setOpen(true);
  };

  const openEdit = (d: Decision) => {
    setEditing(d);
    setForm({
      context: d.context,
      options: d.options,
      choice: d.choice,
      rationale: d.rationale,
      expected_outcome: d.expected_outcome,
      status: d.status,
      reviewed_outcome: d.reviewed_outcome,
    });
    setOptionsInput(d.options.join("\n"));
    setOpen(true);
  };

  const submit = async () => {
    if (!form.context.trim()) {
      toast.error("Context is required");
      return;
    }
    const opts = optionsInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setSubmitting(true);
    try {
      if (editing) {
        await updateDecision(editing.id, { ...form, options: opts });
        toast.success("Decision updated");
      } else {
        await createDecision({ ...form, options: opts });
        toast.success("Decision logged");
      }
      setOpen(false);
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (d: Decision) => {
    if (!window.confirm("Delete this decision entry?")) return;
    try {
      await deleteDecision(d.id);
      toast.success("Decision deleted");
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Delete failed");
    }
  };

  const advance = async (d: Decision) => {
    const next: DecisionStatus = d.status === "open" ? "committed" : "reviewed";
    try {
      await updateDecision(d.id, { status: next, ...(next === "reviewed" ? { reviewed_at: new Date().toISOString().slice(0, 10) } : {}) });
      toast.success(`Decision moved to ${next}`);
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Update failed");
    }
  };

  const grouped = useMemo(() => {
    return {
      open: items.filter((d) => d.status === "open"),
      committed: items.filter((d) => d.status === "committed"),
      reviewed: items.filter((d) => d.status === "reviewed"),
    };
  }, [items]);

  return (
    <div>
      <PageHeader
        eyebrow="Sandbox"
        title="Decision audit"
        description="Every meaningful choice becomes a row here. Capture the context, the options, the rationale, and the expected outcome — review later, honestly."
        actions={
          <Button onClick={openNew} className="h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90">
            <Plus className="size-4" />
            Log decision
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {(["open", "committed", "reviewed"] as const).map((bucket) => (
          <Panel
            key={bucket}
            title={bucket.charAt(0).toUpperCase() + bucket.slice(1)}
            subtitle={`${grouped[bucket].length} entr${grouped[bucket].length === 1 ? "y" : "ies"}`}
            contentClassName="px-0 py-0"
          >
            {grouped[bucket].length === 0 ? (
              <div className="p-5">
                <EmptyHint title="Empty" hint={bucket === "open" ? "Log decisions as they appear." : undefined} />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {grouped[bucket].map((d) => (
                  <li key={d.id} className="space-y-2 px-5 py-4">
                    <div className="flex items-start gap-2">
                      <Scale className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 flex-1 text-[13px] font-medium leading-5">{d.context}</p>
                    </div>
                    {d.options.length ? (
                      <ul className="space-y-0.5 pl-6 text-[12px] text-muted-foreground">
                        {d.options.slice(0, 4).map((o, i) => (
                          <li key={i} className="line-clamp-1">
                            · {o}
                          </li>
                        ))}
                        {d.options.length > 4 ? <li className="text-[11px]">+{d.options.length - 4} more</li> : null}
                      </ul>
                    ) : null}
                    {d.choice ? (
                      <p className="pl-6 text-[12px] text-[var(--info)]">
                        Choice: <span className="text-foreground">{d.choice}</span>
                      </p>
                    ) : null}
                    {d.rationale ? (
                      <p className="line-clamp-2 pl-6 text-[12px] text-muted-foreground">{d.rationale}</p>
                    ) : null}
                    {d.expected_outcome ? (
                      <p className="line-clamp-2 pl-6 text-[12px] text-muted-foreground">
                        <span className="text-foreground">Expected:</span> {d.expected_outcome}
                      </p>
                    ) : null}
                    {d.reviewed_outcome ? (
                      <p className="line-clamp-2 pl-6 text-[12px] text-[var(--positive)]">
                        <span className="text-foreground">Actual:</span> {d.reviewed_outcome}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between pl-6 pt-1">
                      <span className={cn("ax-status", STATUS_TONE[d.status])}>{d.status}</span>
                      <div className="flex items-center gap-1">
                        {d.status !== "reviewed" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => advance(d)}
                            className="h-7 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
                          >
                            {d.status === "open" ? "Commit" : "Mark reviewed"}
                            {d.status === "open" ? <ArrowRight className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(d)} aria-label="Edit">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(d)}
                          aria-label="Delete"
                          className="text-muted-foreground hover:text-[var(--danger)]"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? "Edit decision" : "Log a decision"}</DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              The honest pre-mortem: write what you saw, what you considered, what you chose, and why.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Context</Label>
              <Textarea
                value={form.context}
                onChange={(e) => setForm((s) => ({ ...s, context: e.target.value }))}
                placeholder="What choice are you facing?"
                className="min-h-20 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Options (one per line)
              </Label>
              <Textarea
                value={optionsInput}
                onChange={(e) => setOptionsInput(e.target.value)}
                placeholder={"Option A\nOption B\nOption C"}
                className="min-h-20 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Choice</Label>
              <Input
                value={form.choice ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, choice: e.target.value }))}
                placeholder="The option you picked"
                className="h-9 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Rationale</Label>
              <Textarea
                value={form.rationale ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, rationale: e.target.value }))}
                placeholder="Why this option?"
                className="min-h-16 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Expected outcome</Label>
              <Textarea
                value={form.expected_outcome ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, expected_outcome: e.target.value }))}
                placeholder="If this works, what does success look like in 30/90 days?"
                className="min-h-16 rounded-md text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as DecisionStatus }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {form.status === "reviewed" ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Actual outcome</Label>
                  <Input
                    value={form.reviewed_outcome ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, reviewed_outcome: e.target.value }))}
                    placeholder="What actually happened?"
                    className="h-9 rounded-md"
                  />
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting} className="h-9 rounded-md">
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !form.context.trim()}
              className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90"
            >
              {submitting ? "Saving…" : editing ? "Save" : "Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
