import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownView } from "@/components/lifeos/MarkdownView";
import { PageHeader } from "@/components/lifeos/PageHeader";
import { EmptyState } from "@/components/lifeos/EmptyState";
import type { DocPayload } from "@/types";

export function DocPage({
  docId,
  getDoc,
  icon: Icon,
  title,
}: {
  docId: string;
  getDoc: (id: string) => Promise<DocPayload>;
  icon: LucideIcon;
  title: string;
}) {
  const [doc, setDoc] = useState<DocPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDoc(null);
    setError("");
    getDoc(docId)
      .then(setDoc)
      .catch((exc: unknown) => setError(exc instanceof Error ? exc.message : "文档读取失败"));
  }, [docId, getDoc]);

  return (
    <div className="space-y-5">
      <DocHero icon={Icon} title={doc?.title || title} summary={doc?.summary} updatedAt={doc?.updatedAt} />
      {error ? <EmptyState title="文档读取失败" detail={error} /> : null}
      {doc ? <MarkdownView content={doc.content} /> : <SkeletonRows />}
    </div>
  );
}

export function DocHero({
  icon: Icon,
  title,
  summary,
  updatedAt,
}: {
  icon: LucideIcon;
  title: string;
  summary?: string;
  updatedAt?: string | null;
}) {
  return (
    <Card>
      <CardContent className="flex gap-4 p-5 sm:p-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <Icon className="size-5" />
        </span>
        <PageHeader eyebrow="Markdown" title={title}>
          {summary ? <p>{summary}</p> : null}
          {updatedAt ? <p className="text-xs text-muted-foreground">最近更新：{updatedAt}</p> : null}
        </PageHeader>
      </CardContent>
    </Card>
  );
}

export function SkeletonRows() {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}
