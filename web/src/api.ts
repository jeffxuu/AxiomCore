import type {
  BootstrapPayload,
  AuthConfigPayload,
  BrandConfigPayload,
  CurrentStatePayload,
  DocPayload,
  DocsPayload,
  ExportPayload,
  LifeOSDay,
  SavePayload
} from "./types";

type ApiErrorPayload = {
  detail?: unknown;
  error?: unknown;
};

function errorValueToText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(errorValueToText).filter((part): part is string => Boolean(part));
    return parts.length ? parts.join("；") : null;
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
      return location ? `${location}：${message}` : message;
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
    throw new Error(formatApiError(payload, `请求失败：${response.status}`));
  }

  return payload;
}

export function loadAuthConfig(): Promise<AuthConfigPayload> {
  return requestJson<AuthConfigPayload>("/api/auth/config");
}

export function loadBrandConfig(): Promise<BrandConfigPayload> {
  return requestJson<BrandConfigPayload>("/api/config");
}

export type AuthStatusPayload = {
  ok: true;
  authenticated: boolean;
  authRequired: boolean;
};

export async function probeAuth(): Promise<AuthStatusPayload> {
  // Plain fetch — must NOT route through requestJson, which auto-redirects on 401.
  // We need an unambiguous answer to decide whether to render protected UI.
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: true, authenticated: false, authRequired: true };
  }
  const payload = (await response.json().catch(() => null)) as Partial<AuthStatusPayload> | null;
  return {
    ok: true,
    authenticated: Boolean(payload?.authenticated),
    authRequired: payload?.authRequired ?? true,
  };
}

export function loadBootstrap(date: string): Promise<BootstrapPayload> {
  return requestJson<BootstrapPayload>(`/api/bootstrap?date=${encodeURIComponent(date)}`);
}

export function saveDay(day: LifeOSDay): Promise<SavePayload> {
  return requestJson<SavePayload>("/api/day", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: day.date,
      entry: day.entry,
      tasks: day.tasks
    })
  });
}

export function exportMarkdown(date: string): Promise<ExportPayload> {
  return requestJson<ExportPayload>(`/api/export?date=${encodeURIComponent(date)}`);
}

export function loadDocs(): Promise<DocsPayload> {
  return requestJson<DocsPayload>("/api/docs");
}

export function loadDoc(id: string): Promise<DocPayload> {
  return requestJson<DocPayload>(`/api/docs/${encodeURIComponent(id)}`);
}

export function loadCurrentState(): Promise<CurrentStatePayload> {
  return requestJson<CurrentStatePayload>("/api/current-state");
}
