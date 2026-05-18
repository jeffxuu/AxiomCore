import { Search } from "lucide-react";

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state panel">
      <Search size={22} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
