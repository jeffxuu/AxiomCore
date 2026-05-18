import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/lifeos/EmptyState";
import { MarkdownView } from "@/components/lifeos/MarkdownView";
import { PageHeader } from "@/components/lifeos/PageHeader";
import { cn } from "@/lib/utils";
import { SkeletonRows } from "./DocPage";
import type { DocMeta, DocPayload } from "@/types";

export function DailyPage({
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
  const dailyDocs = docs.filter((doc) => doc.kind === "daily");
  const selected = selectedId || dailyDocs[0]?.id;
  const selectedDoc = dailyDocs.find((doc) => doc.id === selected);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return dailyDocs;
    return dailyDocs.filter((doc) => `${doc.date ?? ""} ${doc.title} ${doc.summary}`.includes(keyword));
  }, [dailyDocs, query]);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <PageHeader eyebrow="Daily Journal" title="历史记录" action={<Badge variant="outline">{filtered.length} 条</Badge>}>
            <p>按日期查看每日 Markdown。这里专注回看、搜索和复盘，不承担今日录入。</p>
          </PageHeader>
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100vh-7rem)]">
          <CardHeader>
            <CardTitle>日志索引</CardTitle>
            <CardDescription>{selectedDoc?.date ? `当前日期 ${selectedDoc.date}` : "选择一条每日记录"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={query} placeholder="搜索日期或摘要" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <p className="text-xs text-muted-foreground">当前显示 {filtered.length} / {dailyDocs.length} 条记录</p>
            <ScrollArea className="h-[360px] pr-3 lg:h-[calc(100vh-18rem)]">
              <div className="space-y-2">
                {filtered.map((doc) => (
                  <button
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-colors hover:bg-muted",
                      doc.id === selected && "border-slate-950 bg-slate-50 dark:border-white dark:bg-slate-900"
                    )}
                    key={doc.id}
                    type="button"
                    onClick={() => navigate(`/daily?doc=${encodeURIComponent(doc.id)}`)}
                  >
                    <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{doc.date || doc.title}</span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{doc.summary}</span>
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {selected ? <DailyBody docId={selected} getDoc={getDoc} /> : <EmptyState title="还没有每日记录" detail="从今日页保存或导出 Markdown 后，这里会出现历史记录。" />}
      </section>
    </div>
  );
}

function DailyBody({ docId, getDoc }: { docId: string; getDoc: (id: string) => Promise<DocPayload> }) {
  const [doc, setDoc] = useState<DocPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDoc(null);
    setError("");
    getDoc(docId)
      .then(setDoc)
      .catch((exc: unknown) => setError(exc instanceof Error ? exc.message : "记录读取失败"));
  }, [docId, getDoc]);

  if (error) return <EmptyState title="记录读取失败" detail={error} />;
  if (!doc) return <SkeletonRows />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
        <span className="font-medium">{doc.date || doc.title}</span>
        {doc.updatedAt ? <span className="text-xs text-muted-foreground">更新 {doc.updatedAt}</span> : null}
      </div>
      <MarkdownView content={doc.content} />
    </div>
  );
}
