import { RefreshCcw, Save } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

export function SaveBar({
  date,
  status,
  saving,
  onDateChange,
  onRefresh,
  onSave,
}: {
  date: string;
  status: string;
  saving: boolean;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onSave: () => void;
}) {
  return (
    <div className="save-bar">
      <label className="save-date">
        <span>日期</span>
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </label>
      <span className={`save-status${status.startsWith("已") || status.startsWith("✓") ? " ok" : ""}`}>
        {status || "未保存"}
      </span>
      <div className="save-actions">
        <IconButton label="刷新" onClick={onRefresh}>
          <RefreshCcw size={16} />
        </IconButton>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          <Save size={16} />
          {saving ? "保存中" : "保存"}
        </Button>
      </div>
    </div>
  );
}
