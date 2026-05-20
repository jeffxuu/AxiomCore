import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, Command, KeyRound, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import { loadAuthConfig } from "@/api";
import { useBrand } from "@/lib/brandConfig";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";
import "altcha";

type PortalProvider = {
  key: string;
  label: string;
  engines: string[];
};

const PROVIDERS: PortalProvider[] = [
  {
    key: "openai",
    label: "OPENAI",
    engines: ["gpt-5.2", "gpt-5.1-codex", "o4-mini"],
  },
  {
    key: "anthropic",
    label: "ANTHROPIC",
    engines: ["claude-sonnet-4.5", "claude-opus-4.1", "claude-haiku-4.5"],
  },
  {
    key: "google",
    label: "GOOGLE",
    engines: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  {
    key: "deepseek",
    label: "DEEPSEEK",
    engines: ["deepseek-r1", "deepseek-v3.2", "deepseek-chat"],
  },
];

const monoTnum: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum" 1, "zero" 1',
};

function MiniMeta({ children }: { children: string }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
      {children}
    </span>
  );
}

function SelectShell({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0 space-y-1">
      <MiniMeta>{label}</MiniMeta>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-9 w-full appearance-none rounded-md border px-3 pr-8 text-[12px] font-normal outline-none transition-colors duration-[180ms]",
            "border-[var(--portal-border)] bg-[var(--portal-control)] text-[var(--portal-text)]",
            "hover:border-[var(--portal-text)]/30 focus:border-[var(--portal-text)]/45 focus:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={monoTnum}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 opacity-55" />
      </span>
    </label>
  );
}

export function LoginPage() {
  const t = useT();
  const brand = useBrand();
  const [altchaEnabled, setAltchaEnabled] = useState(false);
  const [sessionTtlLabel, setSessionTtlLabel] = useState("8h");
  const [configError, setConfigError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [providerKey, setProviderKey] = useState(PROVIDERS[0].key);
  const provider = useMemo(
    () => PROVIDERS.find((item) => item.key === providerKey) ?? PROVIDERS[0],
    [providerKey],
  );
  const [engine, setEngine] = useState(provider.engines[0]);

  const urlError = new URLSearchParams(window.location.search).get("error") ?? "";
  const errorMessage = configError || urlError;

  useEffect(() => {
    loadAuthConfig()
      .then((payload) => {
        setAltchaEnabled(Boolean(payload.altchaEnabled));
        setSessionTtlLabel(payload.sessionTtlLabel);
      })
      .catch((exc: unknown) => {
        setConfigError(exc instanceof Error ? exc.message : t("login.error.fallback"));
      });
  }, [t]);

  useEffect(() => {
    setEngine((current) => (provider.engines.includes(current) ? current : provider.engines[0]));
  }, [provider]);

  return (
    <div
      className={cn(
        "w-full text-[12.5px] font-normal transition-colors duration-[180ms]",
        "text-[var(--portal-text)]",
      )}
      style={{
        "--portal-bg": "var(--ax-bg, #FAF9F6)",
        "--portal-card": "var(--ax-card, #FFFFFF)",
        "--portal-border": "var(--ax-border, #EAE9E6)",
        "--portal-text": "var(--ax-text, #1C1917)",
        "--portal-muted": "var(--ax-muted, #78716C)",
        "--portal-control": "color-mix(in srgb, var(--ax-card, #FFFFFF) 92%, var(--ax-bg, #FAF9F6))",
      } as CSSProperties}
    >
      <div
        className={cn(
          "rounded-xl border px-6 py-4.5 shadow-[0_18px_60px_-46px_rgba(28,25,23,0.45)]",
          "border-[var(--portal-border)] bg-[var(--portal-card)] transition-colors duration-[180ms]",
        )}
      >
        <header className="flex items-start justify-between gap-5 border-b border-[var(--portal-border)] pb-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <MiniMeta>PUBLIC SANDBOX</MiniMeta>
              <span className="h-3 w-px bg-[var(--portal-border)]" aria-hidden />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider opacity-75" style={monoTnum}>
                ROOT / 6.13
              </span>
            </div>
            <div className="space-y-1">
              <h1 className="text-[12.5px] font-medium leading-tight tracking-normal">
                {brand.brandName}
              </h1>
              <p className="max-w-[520px] text-[12.5px] font-normal leading-5 text-[var(--portal-muted)]">
                一枚公开入口，只保留登录、NLP 沙箱与模型路由；隐私资产图表在授权后的账本内部呈现。
              </p>
            </div>
          </div>
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md border",
              "border-[var(--portal-border)] bg-[var(--portal-control)]",
            )}
            aria-hidden
          >
            <LockKeyhole className="size-4" strokeWidth={1.7} />
          </span>
        </header>

        <section className="grid gap-3 border-b border-[var(--portal-border)] py-4">
          <div className="grid grid-cols-1 border-y border-[var(--portal-border)] sm:grid-cols-3 sm:divide-x sm:divide-[var(--portal-border)]">
            <div className="px-0 py-2 sm:px-3">
              <MiniMeta>STATUS</MiniMeta>
              <p className="mt-1 text-xs font-normal text-[var(--portal-text)]">门户待授权</p>
            </div>
            <div className="border-t border-[var(--portal-border)] px-0 py-2 sm:border-t-0 sm:px-3">
              <MiniMeta>SESSION</MiniMeta>
              <p className="mt-1 font-mono text-xs font-normal text-[var(--portal-text)]" style={monoTnum}>
                {sessionTtlLabel}
              </p>
            </div>
            <div className="border-t border-[var(--portal-border)] px-0 py-2 sm:border-t-0 sm:px-3">
              <MiniMeta>PRIVACY</MiniMeta>
              <p className="mt-1 text-xs font-normal text-[var(--portal-text)]">图表隔离</p>
            </div>
          </div>

          <label className="space-y-1">
            <span className="flex items-center gap-1.5">
              <Command className="size-3.5 opacity-65" strokeWidth={1.7} />
              <MiniMeta>NLP INPUT</MiniMeta>
            </span>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="输入一条公开沙箱指令，例如：记录今天的现金流或复盘一个决策"
              className={cn(
                "h-9 w-full rounded-md border px-3 text-[12.5px] font-normal outline-none transition-colors duration-[180ms]",
                "border-[var(--portal-border)] bg-[var(--portal-control)] text-[var(--portal-text)]",
                "placeholder:text-[var(--portal-muted)] placeholder:opacity-70",
                "hover:border-[var(--portal-text)]/30 focus:border-[var(--portal-text)]/45 focus:ring-0",
              )}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_176px] sm:items-end">
            <div className="hidden min-w-0 items-center gap-2 pb-2 text-[12px] font-normal text-[var(--portal-muted)] sm:flex">
              <Network className="size-3.5" strokeWidth={1.7} />
              <span className="truncate">
                当前路由由 <span className="font-mono" style={monoTnum}>{provider.label}</span> 接管，模型为{" "}
                <span className="font-mono" style={monoTnum}>{engine}</span>
              </span>
            </div>
            <SelectShell label="PROVIDER" value={providerKey} onChange={setProviderKey}>
              {PROVIDERS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </SelectShell>
            <SelectShell label="ENGINE" value={engine} onChange={setEngine}>
              {provider.engines.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectShell>
          </div>
        </section>

        <form method="post" action="/api/login" className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 opacity-65" strokeWidth={1.7} />
                <MiniMeta>{t("login.username")}</MiniMeta>
              </span>
              <input
                id="username"
                name="username"
                autoComplete="username"
                required
                className={cn(
                  "h-9 w-full rounded-md border px-3 text-[12.5px] font-normal outline-none transition-colors duration-[180ms]",
                  "border-[var(--portal-border)] bg-[var(--portal-control)] text-[var(--portal-text)]",
                  "hover:border-[var(--portal-text)]/30 focus:border-[var(--portal-text)]/45 focus:ring-0",
                )}
              />
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-1.5">
                <KeyRound className="size-3.5 opacity-65" strokeWidth={1.7} />
                <MiniMeta>{t("login.password")}</MiniMeta>
              </span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={cn(
                  "h-9 w-full rounded-md border px-3 text-[12.5px] font-normal outline-none transition-colors duration-[180ms]",
                  "border-[var(--portal-border)] bg-[var(--portal-control)] text-[var(--portal-text)]",
                  "hover:border-[var(--portal-text)]/30 focus:border-[var(--portal-text)]/45 focus:ring-0",
                )}
              />
            </label>
          </div>

          {altchaEnabled ? (
            <div className="mt-3">
              <altcha-widget
                challenge="/api/altcha"
                name="altcha"
                auto="onload"
                hidefooter
                style={{
                  "--altcha-max-width": "100%",
                  "--altcha-border-radius": "6px",
                  "--altcha-border-color": "var(--portal-border)",
                  "--altcha-color-base": "var(--portal-control)",
                  "--altcha-padding": "8px 12px",
                  "--altcha-shadow": "none",
                } as CSSProperties}
              />
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3 py-2 text-[12px] font-normal text-[var(--danger)]">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] font-normal text-[var(--portal-muted)]">
              {t("login.session", { x: sessionTtlLabel })}
            </p>
            <button
              type="submit"
              className={cn(
                "h-9 rounded-md border px-4 text-[12px] font-normal transition-colors duration-[180ms]",
                "border-[var(--portal-text)]/35 bg-transparent text-[var(--portal-text)]",
                "hover:border-[var(--portal-text)] hover:bg-[var(--portal-control)] focus:outline-none focus:ring-0",
              )}
            >
              进入账本
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
