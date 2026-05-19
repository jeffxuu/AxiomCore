// Frontend ↔ axiom_server.py contract.
// V4 schema: business sandbox — Capital baseline + Transactions, Projects, Decisions.

export type Baseline = {
  starting_position: number;
  baseline_date: string;
  note: string;
};

export type CapitalSnapshot = {
  net_position: number;
  total_in: number;
  total_out: number;
  monthly_in: number;
  monthly_out: number;
  monthly_net: number;
  floor: number;
  runway_months: number | null;
};

export type Transaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurred_at: string;
  note: string;
  category: string;
  project_id: string | null;
  created_at: string;
};

export type ProjectStatus = "active" | "paused" | "killed" | "shipped";
export type RiskLevel = "low" | "medium" | "high" | "extreme";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  thesis: string;
  roi_projection: number;
  risk_level: RiskLevel;
  kill_criteria: string;
  capital_committed: number;
  capital_spent: number;
  started_at: string;
  updated_at: string;
};

export type DecisionStatus = "open" | "committed" | "reviewed";

export type Decision = {
  id: string;
  context: string;
  options: string[];
  choice: string;
  rationale: string;
  expected_outcome: string;
  status: DecisionStatus;
  reviewed_outcome: string;
  decided_at: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type TimelinePoint = {
  date: string;
  in: number;
  out: number;
  net: number;
};

export type DashboardPayload = {
  ok: true;
  baseline: Baseline;
  capital: CapitalSnapshot;
  projects: {
    active: Project[];
    all_count: number;
    active_count: number;
  };
  decisions: {
    open: Decision[];
    all_count: number;
    open_count: number;
  };
  recent_tx: Transaction[];
  timeline: TimelinePoint[];
};

export type AuthConfigPayload = {
  ok: true;
  authEnabled: boolean;
  altchaEnabled: boolean;
  sessionTtlLabel: string;
};

export type BrandConfigPayload = {
  ok: true;
  brandName: string;
  tagline: string;
};

export type DocMeta = {
  id: string;
  title: string;
  section: string;
  summary: string;
  relativePath: string;
  updatedAt: string | null;
  sensitive: boolean;
  kind: "markdown";
};

export type DocsPayload = { docs: DocMeta[] };

export type DocPayload = DocMeta & {
  content: string;
  excerpt: string;
};
