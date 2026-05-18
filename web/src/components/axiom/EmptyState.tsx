import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Card className="border-dashed bg-card/70 shadow-none">
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="size-5" />
        </span>
        <div className="space-y-1">
          <h2 className="font-medium">{title}</h2>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
