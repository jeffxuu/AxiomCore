import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { loadDoc, loadDocs } from "@/api";
import { EmptyHint, PageHeader, Panel } from "@/components/axiom/primitives";
import { MarkdownView } from "@/components/axiom/MarkdownView";
import { VaultIntakePanel } from "@/components/axiom/VaultIntakePanel";
import { useT } from "@/lib/i18nConfig";
import type { DocMeta, DocPayload } from "@/types";
import { cn } from "@/lib/utils";

type Translate = (key: string) => string;

const DOC_SECTION_KEYS: Record<string, string> = {
  "Axiom Core": "docs.section.axiom",
  System: "docs.section.system",
  Ops: "docs.section.ops",
  Methods: "docs.section.methods",
  "Domains · 9 领域": "docs.section.domains",
};

function translatedOr(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

function localizeDocMeta<T extends DocMeta>(doc: T, t: Translate): T {
  const title = translatedOr(t, `docs.${doc.id}.title`, doc.title);
  const summary = translatedOr(t, `docs.${doc.id}.summary`, doc.summary);
  const sectionKey = DOC_SECTION_KEYS[doc.section];
  const section = sectionKey ? translatedOr(t, sectionKey, doc.section) : doc.section;
  return { ...doc, title, summary, section };
}

export function VaultPage({ selectedId, panel, navigate }: { selectedId?: string; panel?: string; navigate: (href: string) => void }) {
  const t = useT();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const intakeActive = panel === "intake";

  useEffect(() => {
    loadDocs()
      .then((payload) => setDocs(payload.docs.map((doc) => localizeDocMeta(doc, t))))
      .catch((exc) => setError(exc instanceof Error ? exc.message : t("vault.load.fail")));
  }, [t, revision]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return docs;
    return docs.filter((doc) => `${doc.title} ${doc.section} ${doc.summary}`.toLowerCase().includes(keyword));
  }, [docs, query]);

  const selected = selectedId || docs[0]?.id;

  const grouped = useMemo(() => {
    return visible.reduce<Record<string, DocMeta[]>>((acc, doc) => {
      acc[doc.section] = acc[doc.section] || [];
      acc[doc.section].push(doc);
      return acc;
    }, {});
  }, [visible]);

  return (
    <div>
      <PageHeader
        eyebrow={t("vault.eyebrow")}
        title={t("vault.title")}
        description={t("vault.desc")}
        actions={(
          <nav className="flex rounded-md border border-border bg-card p-1" aria-label={t("vault.tabs.aria")}>
            <button
              type="button"
              onClick={() => navigate(`/vault?doc=${encodeURIComponent(selected || "dashboard-method")}`)}
              className={cn("rounded px-3 py-1.5 text-[12px] font-medium transition-colors", !intakeActive ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {t("vault.tabs.library")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/vault?panel=intake")}
              className={cn("rounded px-3 py-1.5 text-[12px] font-medium transition-colors", intakeActive ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {t("vault.tabs.intake")}
            </button>
          </nav>
        )}
      />
      {error ? (
        <div className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}
      {intakeActive ? (
        <VaultIntakePanel onArchived={() => setRevision((value) => value + 1)} />
      ) : (
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel
          title={t("vault.index")}
          subtitle={t("vault.index.count", { visible: visible.length, total: docs.length })}
          contentClassName="space-y-4"
        >
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-md pl-8"
              placeholder={t("common.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="space-y-4">
            {Object.entries(grouped).map(([section, items]) => (
              <div key={section} className="space-y-1">
                <p className="ax-eyebrow px-1">{section}</p>
                {items.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => navigate(`/vault?doc=${encodeURIComponent(doc.id)}`)}
                    className={cn(
                      "block w-full rounded-md border border-transparent px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--accent)] hover:text-foreground",
                      doc.id === selected && "border-border bg-[var(--accent)] text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block pl-5 text-[11px] text-muted-foreground">{doc.summary}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Panel>

        {selected ? <DocBody docId={selected} /> : <EmptyHint title={t("vault.empty")} />}
      </div>
      )}
    </div>
  );
}

function DocBody({ docId }: { docId: string }) {
  const t = useT();
  const [doc, setDoc] = useState<DocPayload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setDoc(null);
    setError("");
    loadDoc(docId)
      .then((payload) => setDoc(localizeDocMeta(payload, t)))
      .catch((exc) => setError(exc instanceof Error ? exc.message : t("vault.read.fail")));
  }, [docId, t]);
  if (error) return <EmptyHint title={t("vault.read.fail")} hint={error} />;
  if (!doc)
    return (
      <Panel>
        <p className="text-[13px] text-muted-foreground">{t("common.loading")}</p>
      </Panel>
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
        <span className="text-[13px] font-semibold">{doc.title}</span>
        {doc.updatedAt ? (
          <span className="text-[11px] text-muted-foreground">{t("vault.updated", { x: doc.updatedAt })}</span>
        ) : null}
      </div>
      <MarkdownView content={doc.content} />
    </div>
  );
}
