import type { ReactNode } from "react";

export function MarkdownView({ content }: { content: string }) {
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
      nodes.push(<pre key={`code-${index}`}>{code.join("\n")}</pre>);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const text = heading[2];
      if (level === 1) nodes.push(<h1 key={`h-${index}`}>{text}</h1>);
      if (level === 2) nodes.push(<h2 key={`h-${index}`}>{text}</h2>);
      if (level === 3) nodes.push(<h3 key={`h-${index}`}>{text}</h3>);
      if (level >= 4) nodes.push(<h4 key={`h-${index}`}>{text}</h4>);
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
        <ListTag key={`list-${index}`}>
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
      nodes.push(<blockquote key={`quote-${index}`}>{quotes.map(renderInline)}</blockquote>);
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
    nodes.push(<p key={`p-${index}`}>{renderInline(paragraph.join(" "))}</p>);
  }

  return <article className="markdown-body panel">{nodes}</article>;
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line))
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
  const [head, ...body] = rows;

  return (
    <div className="table-wrap">
      <table>
        {head ? (
          <thead>
            <tr>{head.map((cell) => <th key={cell}>{renderInline(cell)}</th>)}</tr>
          </thead>
        ) : null}
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{renderInline(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}
