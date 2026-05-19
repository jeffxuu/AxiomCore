import type {
  AuthConfigPayload,
  Baseline,
  BrandConfigPayload,
  DashboardPayload,
  Decision,
  DecisionStatus,
  DocPayload,
  DocsPayload,
  Project,
  ProjectStatus,
  RiskLevel,
  Transaction,
} from "./types";

type ApiErrorPayload = { detail?: unknown; error?: unknown };

function errorValueToText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(errorValueToText).filter((part): part is string => Boolean(part));
    return parts.length ? parts.join("; ") : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const message =
      errorValueToText(record.message) ||
      errorValueToText(record.msg) ||
      errorValueToText(record.detail) ||
      errorValueToText(record.error);
    if (message) {
      const location = Array.isArray(record.loc) ? record.loc.map(String).filter(Boolean).join(".") : "";
      return location ? `${location}: ${message}` : message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return null;
}

export function formatApiError(payload: ApiErrorPayload, fallback: string): string {
  return errorValueToText(payload.detail) || errorValueToText(payload.error) || fallback;
}

export async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) {
    if (response.status === 401 && window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
    throw new Error(formatApiError(payload, `Request failed: ${response.status}`));
  }
  return payload;
}

const jsonHeaders = { "Content-Type": "application/json" };

export function loadAuthConfig(): Promise<AuthConfigPayload> {
  return requestJson<AuthConfigPayload>("/api/auth/config");
}

export function loadBrandConfig(): Promise<BrandConfigPayload> {
  return requestJson<BrandConfigPayload>("/api/config");
}

export type AuthStatusPayload = { ok: true; authenticated: boolean; authRequired: boolean };

export async function probeAuth(): Promise<AuthStatusPayload> {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return { ok: true, authenticated: false, authRequired: true };
  const payload = (await response.json().catch(() => null)) as Partial<AuthStatusPayload> | null;
  return {
    ok: true,
    authenticated: Boolean(payload?.authenticated),
    authRequired: payload?.authRequired ?? true,
  };
}

// ── Dashboard ─────────────────────────────────────────────────────
export function loadDashboard(): Promise<DashboardPayload> {
  return requestJson<DashboardPayload>("/api/dashboard");
}

// ── Capital ───────────────────────────────────────────────────────
export function loadBaseline(): Promise<{ ok: true; baseline: Baseline }> {
  return requestJson<{ ok: true; baseline: Baseline }>("/api/capital/baseline");
}

export function updateBaseline(input: { starting_position: number; baseline_date?: string; note?: string }): Promise<{ ok: true; baseline: Baseline }> {
  return requestJson<{ ok: true; baseline: Baseline }>("/api/capital/baseline", {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export function loadTransactions(limit = 200): Promise<{ ok: true; transactions: Transaction[] }> {
  return requestJson<{ ok: true; transactions: Transaction[] }>(`/api/capital/tx?limit=${limit}`);
}

export type TxInput = {
  kind: "income" | "expense";
  amount: number;
  occurred_at?: string;
  note?: string;
  category?: string;
  project_id?: string | null;
};

export function createTransaction(input: TxInput): Promise<{ ok: true; transaction: Transaction }> {
  return requestJson<{ ok: true; transaction: Transaction }>("/api/capital/tx", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(id: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/api/capital/tx/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Projects ──────────────────────────────────────────────────────
export type ProjectInput = {
  name: string;
  status?: ProjectStatus;
  thesis?: string;
  roi_projection?: number;
  risk_level?: RiskLevel;
  kill_criteria?: string;
  capital_committed?: number;
  capital_spent?: number;
};

export function loadProjects(): Promise<{ ok: true; projects: Project[] }> {
  return requestJson<{ ok: true; projects: Project[] }>("/api/projects");
}

export function createProject(input: ProjectInput): Promise<{ ok: true; project: Project }> {
  return requestJson<{ ok: true; project: Project }>("/api/projects", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export function updateProject(id: string, patch: Partial<ProjectInput>): Promise<{ ok: true; project: Project }> {
  return requestJson<{ ok: true; project: Project }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(patch),
  });
}

export function deleteProject(id: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Decisions ─────────────────────────────────────────────────────
export type DecisionInput = {
  context: string;
  options?: string[];
  choice?: string;
  rationale?: string;
  expected_outcome?: string;
  status?: DecisionStatus;
  decided_at?: string | null;
};

export function loadDecisions(): Promise<{ ok: true; decisions: Decision[] }> {
  return requestJson<{ ok: true; decisions: Decision[] }>("/api/decisions");
}

export function createDecision(input: DecisionInput): Promise<{ ok: true; decision: Decision }> {
  return requestJson<{ ok: true; decision: Decision }>("/api/decisions", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export function updateDecision(id: string, patch: Partial<DecisionInput> & { reviewed_outcome?: string; reviewed_at?: string }): Promise<{ ok: true; decision: Decision }> {
  return requestJson<{ ok: true; decision: Decision }>(`/api/decisions/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(patch),
  });
}

export function deleteDecision(id: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/api/decisions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Docs / Vault ──────────────────────────────────────────────────
export function loadDocs(): Promise<DocsPayload> {
  return requestJson<DocsPayload>("/api/docs");
}

export function loadDoc(id: string): Promise<DocPayload> {
  return requestJson<DocPayload>(`/api/docs/${encodeURIComponent(id)}`);
}
