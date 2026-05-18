import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export function QuickEntryGroup({
  value,
  icon: Icon,
  title,
  badge,
  children,
}: {
  value: string;
  icon: LucideIcon;
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-border/70">
      <AccordionTrigger className="rounded-lg px-1 py-4 hover:no-underline">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{title}</span>
            {badge ? <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{badge}</span> : null}
          </span>
        </span>
        {badge ? <Badge variant="secondary" className="mr-3 hidden sm:inline-flex">{badge}</Badge> : null}
      </AccordionTrigger>
      <AccordionContent className="pb-5 pl-0 sm:pl-12">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
