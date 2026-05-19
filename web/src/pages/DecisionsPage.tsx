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
import { EmptyHint, PageHeader, Panel } from "@/components/axiom/primitives";
import { useT } from "@/lib/i18nConfig";
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

export function DecisionsPage({ onStatus }: { onStatus: (status: string) => void }) {
  const t = useT();
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
      toast.error(exc instanceof Error ? exc.message : t("decisions.toast.loadFail"));
    }
  }, [onStatus, t]);

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
      toast.error(t("decisions.form.context.required"));
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
        toast.success(t("decisions.toast.updated"));
      } else {
        await createDecision({ ...form, options: opts });
        toast.success(t("decisions.toast.created"));
      }
      setOpen(false);
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : t("decisions.toast.saveFail"));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (d: Decision) => {
    if (!window.confirm(t("decisions.confirm.delete"))) return;
    try {
      await deleteDecision(d.id);
      toast.success(t("decisions.toast.deleted"));
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : t("decisions.toast.deleteFail"));
    }
  };

  const advance = async (d: Decision) => {
    const next: DecisionStatus = d.status === "open" ? "committed" : "reviewed";
    try {
      await updateDecision(d.id, {
        status: next,
        ...(next === "reviewed" ? { reviewed_at: new Date().toISOString().slice(0, 10) } : {}),
      });
      toast.success(t("decisions.toast.advance", { x: t(`decisions.status.${next}`) }));
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : t("decisions.toast.updateFail"));
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
        eyebrow={t("decisions.eyebrow")}
        title={t("decisions.title")}
        description={t("decisions.desc")}
        actions={
          <Button onClick={openNew} className="h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90">
            <Plus className="size-4" />
            {t("decisions.action.new")}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {(["open", "committed", "reviewed"] as const).map((bucket) => (
          <Panel
            key={bucket}
            title={t(`decisions.bucket.${bucket}`)}
            subtitle={t(
              grouped[bucket].length === 1 ? "decisions.bucket.count.one" : "decisions.bucket.count.other",
              { n: grouped[bucket].length }
            )}
            contentClassName="px-0 py-0"
          >
            {grouped[bucket].length === 0 ? (
              <div className="p-5">
                <EmptyHint title={t("decisions.empty")} hint={bucket === "open" ? t("decisions.empty.hint") : undefined} />
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
                        {d.options.length > 4 ? (
                          <li className="text-[11px]">{t("decisions.row.more", { n: d.options.length - 4 })}</li>
                        ) : null}
                      </ul>
                    ) : null}
                    {d.choice ? (
                      <p className="pl-6 text-[12px] text-[var(--info)]">
                        {t("decisions.row.choice", { choice: d.choice })}
                      </p>
                    ) : null}
                    {d.rationale ? (
                      <p className="line-clamp-2 pl-6 text-[12px] text-muted-foreground">{d.rationale}</p>
                    ) : null}
                    {d.expected_outcome ? (
                      <p className="line-clamp-2 pl-6 text-[12px] text-muted-foreground">
                        {t("decisions.row.expected", { x: d.expected_outcome })}
                      </p>
                    ) : null}
                    {d.reviewed_outcome ? (
                      <p className="line-clamp-2 pl-6 text-[12px] text-[var(--positive)]">
                        {t("decisions.row.actual", { x: d.reviewed_outcome })}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between pl-6 pt-1">
                      <span className={cn("ax-status", STATUS_TONE[d.status])}>{t(`decisions.status.${d.status}`)}</span>
                      <div className="flex items-center gap-1">
                        {d.status !== "reviewed" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => advance(d)}
                            className="h-7 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
                          >
                            {d.status === "open" ? t("decisions.row.advance.commit") : t("decisions.row.advance.review")}
                            {d.status === "open" ? <ArrowRight className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(d)} aria-label={t("common.edit")}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(d)}
                          aria-label={t("common.delete")}
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
            <DialogTitle className="text-base">
              {editing ? t("decisions.form.title.edit") : t("decisions.form.title.new")}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              {t("decisions.form.desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("decisions.form.context")}
              </Label>
              <Textarea
                value={form.context}
                onChange={(e) => setForm((s) => ({ ...s, context: e.target.value }))}
                placeholder={t("decisions.form.context.ph")}
                className="min-h-20 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("decisions.form.options")}
              </Label>
              <Textarea
                value={optionsInput}
                onChange={(e) => setOptionsInput(e.target.value)}
                placeholder={t("decisions.form.options.ph")}
                className="min-h-20 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("decisions.form.choice")}
              </Label>
              <Input
                value={form.choice ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, choice: e.target.value }))}
                placeholder={t("decisions.form.choice.ph")}
                className="h-9 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("decisions.form.rationale")}
              </Label>
              <Textarea
                value={form.rationale ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, rationale: e.target.value }))}
                placeholder={t("decisions.form.rationale.ph")}
                className="min-h-16 rounded-md text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("decisions.form.expected")}
              </Label>
              <Textarea
                value={form.expected_outcome ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, expected_outcome: e.target.value }))}
                placeholder={t("decisions.form.expected.ph")}
                className="min-h-16 rounded-md text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("decisions.form.status")}
                </Label>
                <select
                  aria-label={t("decisions.form.status")}
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as DecisionStatus }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`decisions.status.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              {form.status === "reviewed" ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t("decisions.form.actual")}
                  </Label>
                  <Input
                    value={form.reviewed_outcome ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, reviewed_outcome: e.target.value }))}
                    placeholder={t("decisions.form.actual.ph")}
                    className="h-9 rounded-md"
                  />
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting} className="h-9 rounded-md">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !form.context.trim()}
              className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90"
            >
              {submitting ? t("common.saving") : editing ? t("common.save") : t("decisions.form.submit.new")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
