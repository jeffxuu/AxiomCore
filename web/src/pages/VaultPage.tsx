import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { loadDoc, loadDocs } from "@/api";
import { EmptyHint, PageHeader, Panel } from "@/components/axiom/primitives";
import { MarkdownView } from "@/components/axiom/MarkdownView";
import { useT } from "@/lib/i18nConfig";
import type { DocMeta, DocPayload } from "@/types";
import { cn } from "@/lib/utils";

export function VaultPage({ selectedId, navigate }: { selectedId?: string; navigate: (href: string) => void }) {
  const t = useT();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadDocs()
      .then((payload) => setDocs(payload.docs))
      .catch((exc) => setError(exc instanceof Error ? exc.message : t("vault.load.fail")));
  }, [t]);

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
      <PageHeader eyebrow={t("vault.eyebrow")} title={t("vault.title")} description={t("vault.desc")} />
      {error ? (
        <div className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}
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
      .then(setDoc)
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
