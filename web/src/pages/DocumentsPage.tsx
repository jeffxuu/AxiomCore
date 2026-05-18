import { useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/axiom/EmptyState";
import { MarkdownView } from "@/components/axiom/MarkdownView";
import { PageHeader } from "@/components/axiom/PageHeader";
import { cn } from "@/lib/utils";
import { SkeletonRows } from "./DocPage";
import type { DocMeta, DocPayload } from "@/types";

export function DocumentsPage({
  docs,
  selectedId,
  getDoc,
  navigate,
}: {
  docs: DocMeta[];
  selectedId?: string;
  getDoc: (id: string) => Promise<DocPayload>;
  navigate: (href: string) => void;
}) {
  const libraryDocs = docs.filter((doc) => doc.kind !== "daily");
  const fallback = libraryDocs.find((doc) => doc.id === "profile") ?? libraryDocs[0];
  const selected = selectedId || fallback?.id;
  const [query, setQuery] = useState("");

  const visibleDocs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return libraryDocs;
    return libraryDocs.filter((doc) => `${doc.title} ${doc.section} ${doc.summary}`.toLowerCase().includes(keyword));
  }, [libraryDocs, query]);

  const groups = useMemo(() => {
    return visibleDocs.reduce<Record<string, DocMeta[]>>((acc, doc) => {
      acc[doc.section] = acc[doc.section] || [];
      acc[doc.section].push(doc);
      return acc;
    }, {});
  }, [visibleDocs]);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <PageHeader eyebrow="Knowledge Base" title="文档资料库" action={<Badge variant="outline">{visibleDocs.length} 篇</Badge>}>
            <p>个人档案、90 天计划、信用/健康/简历摘要和系统说明集中在这里阅读。</p>
          </PageHeader>
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100vh-7rem)]">
          <CardHeader>
            <CardTitle>知识库索引</CardTitle>
            <CardDescription>移动端索引在正文上方，优先保证阅读体验。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={query} placeholder="搜索文档" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <p className="text-xs text-muted-foreground">当前显示 {visibleDocs.length} / {libraryDocs.length} 篇文档</p>
            <ScrollArea className="h-[420px] pr-3 lg:h-[calc(100vh-18rem)]">
              <div className="space-y-5">
                {Object.entries(groups).map(([section, items]) => (
                  <div className="space-y-2" key={section}>
                    <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{section}</h2>
                    {items.map((doc) => (
                      <button
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-colors hover:bg-muted",
                          doc.id === selected && "border-slate-950 bg-slate-50 dark:border-white dark:bg-slate-900"
                        )}
                        key={doc.id}
                        type="button"
                        onClick={() => navigate(`/files?doc=${encodeURIComponent(doc.id)}`)}
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{doc.title}</span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{doc.summary}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {selected ? <DocumentBody docId={selected} getDoc={getDoc} /> : <EmptyState title="暂无文档" detail="后端白名单文档返回后会显示在这里。" />}
      </section>
    </div>
  );
}

function DocumentBody({ docId, getDoc }: { docId: string; getDoc: (id: string) => Promise<DocPayload> }) {
  const [doc, setDoc] = useState<DocPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDoc(null);
    setError("");
    getDoc(docId)
      .then(setDoc)
      .catch((exc: unknown) => setError(exc instanceof Error ? exc.message : "文档读取失败"));
  }, [docId, getDoc]);

  if (error) return <EmptyState title="文档读取失败" detail={error} />;
  if (!doc) return <SkeletonRows />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
        <span className="font-medium">{doc.title}</span>
        {doc.updatedAt ? <span className="text-xs text-muted-foreground">更新 {doc.updatedAt}</span> : null}
      </div>
      <MarkdownView content={doc.content} />
    </div>
  );
}
