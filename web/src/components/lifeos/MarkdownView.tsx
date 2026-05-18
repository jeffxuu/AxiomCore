import type { ReactNode } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function MarkdownView({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith("<!--")) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      nodes.push(<pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-50" key={`code-${index}`}>{code.join("\n")}</pre>);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const text = heading[2];
      if (level === 1) nodes.push(<h1 className="mt-2 text-2xl font-semibold tracking-tight" key={`h-${index}`}>{text}</h1>);
      if (level === 2) nodes.push(<h2 className="mt-8 text-xl font-semibold tracking-tight" key={`h-${index}`}>{text}</h2>);
      if (level === 3) nodes.push(<h3 className="mt-6 text-base font-semibold" key={`h-${index}`}>{text}</h3>);
      if (level >= 4) nodes.push(<h4 className="mt-5 text-sm font-semibold" key={`h-${index}`}>{text}</h4>);
      index += 1;
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      nodes.push(<MarkdownTable key={`table-${index}`} lines={tableLines} />);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && (/^\s*[-*]\s+/.test(lines[index]) || /^\s*\d+\.\s+/.test(lines[index]))) {
        items.push(lines[index].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
        index += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      nodes.push(
        <ListTag className={cn("space-y-2 pl-5 text-sm leading-7", ordered ? "list-decimal" : "list-disc")} key={`list-${index}`}>
          {items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`}>{renderInline(item)}</li>)}
        </ListTag>
      );
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quotes: string[] = [];
      while (index < lines.length && /^>\s+/.test(lines[index])) {
        quotes.push(lines[index].replace(/^>\s+/, ""));
        index += 1;
      }
      nodes.push(<blockquote className="rounded-r-xl border-l-2 border-slate-300 bg-muted/60 px-4 py-3 text-sm leading-7 text-muted-foreground dark:border-slate-600" key={`quote-${index}`}>{quotes.map(renderInline)}</blockquote>);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !lines[index].startsWith("```")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    nodes.push(<p className="text-sm leading-7 text-slate-700 dark:text-slate-300" key={`p-${index}`}>{renderInline(paragraph.join(" "))}</p>);
  }

  return (
    <article className={cn("space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:p-7", className)}>
      {nodes}
    </article>
  );
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line))
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
  const [head, ...body] = rows;

  return (
    <ScrollArea className="w-full rounded-xl border">
      <Table>
        {head ? (
          <TableHeader>
            <TableRow>{head.map((cell) => <TableHead className="whitespace-nowrap" key={cell}>{renderInline(cell)}</TableHead>)}</TableRow>
          </TableHeader>
        ) : null}
        <TableBody>
          {body.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => <TableCell className="whitespace-nowrap" key={`${rowIndex}-${cellIndex}`}>{renderInline(cell)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong className="font-semibold text-foreground" key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code className="rounded-md bg-muted px-1.5 py-0.5 text-[0.85em] text-foreground" key={index}>{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}
