import { useEffect, useState, type CSSProperties } from "react";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { loadAuthConfig } from "@/api";
import { useBrand } from "@/lib/brandConfig";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";
import "altcha";

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

function formatDuration(seconds: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (seconds % 86_400 === 0) return t("login.duration.days", { n: seconds / 86_400 });
  if (seconds % 3_600 === 0) return t("login.duration.hours", { n: seconds / 3_600 });
  if (seconds % 60 === 0) return t("login.duration.minutes", { n: seconds / 60 });
  return t("login.duration.seconds", { n: seconds });
}

const LOGIN_ERROR_TRANSLATIONS: Record<string, string> = {
  "登录暂时不可用，请稍后重试。": "login.error.unavailable",
  "服务暂时不可用，请稍后重试。": "login.error.serviceUnavailable",
  "请求频率过高，请稍后再试。": "login.error.rateLimited",
  "登录失败次数过多，请稍后再试。": "login.error.attemptsExceeded",
  "登录请求格式错误，请重试。": "login.error.invalidRequest",
  "请输入账号和密码。": "login.error.credentialsRequired",
  "登录未配置，请先设置 AXIOM_WEB_PASSWORD。": "login.error.notConfigured",
  "人机验证未完成，请等待校验后重试。": "login.error.verificationRequired",
  "人机验证失败，请刷新页面后重试。": "login.error.verificationFailed",
  "账号已被临时锁定，请 10 分钟后重试。": "login.error.locked",
  "账号或密码不正确。": "login.error.invalidCredentials",
  "会话创建失败，请稍后重试。": "login.error.sessionFailed",
};

export function LoginPage() {
  const t = useT();
  const brand = useBrand();
  const [altchaEnabled, setAltchaEnabled] = useState(false);
  const [sessionTtlSeconds, setSessionTtlSeconds] = useState(8 * 3_600);
  const [configError, setConfigError] = useState("");
  const sessionTtlLabel = formatDuration(sessionTtlSeconds, t);

  const urlError = new URLSearchParams(window.location.search).get("error") ?? "";
  const errorMessage = configError || (LOGIN_ERROR_TRANSLATIONS[urlError] ? t(LOGIN_ERROR_TRANSLATIONS[urlError]) : urlError);

  useEffect(() => {
    loadAuthConfig()
      .then((payload) => {
        setAltchaEnabled(Boolean(payload.altchaEnabled));
        setSessionTtlSeconds(payload.sessionTtlSeconds ?? 8 * 3_600);
      })
      .catch((exc: unknown) => {
        setConfigError(exc instanceof Error ? exc.message : t("login.error.fallback"));
      });
  }, [t]);

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
              <MiniMeta>{t("login.access")}</MiniMeta>
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
                {t("login.description")}
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
              <MiniMeta>{t("login.status")}</MiniMeta>
              <p className="mt-1 text-xs font-normal text-[var(--portal-text)]">{t("login.status.waiting")}</p>
            </div>
            <div className="border-t border-[var(--portal-border)] px-0 py-2 sm:border-t-0 sm:px-3">
              <MiniMeta>{t("login.session.label")}</MiniMeta>
              <p className="mt-1 font-mono text-xs font-normal text-[var(--portal-text)]" style={monoTnum}>
                {sessionTtlLabel}
              </p>
            </div>
            <div className="border-t border-[var(--portal-border)] px-0 py-2 sm:border-t-0 sm:px-3">
              <MiniMeta>{t("login.privacy")}</MiniMeta>
              <p className="mt-1 text-xs font-normal text-[var(--portal-text)]">{t("login.privacy.value")}</p>
            </div>
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
              {t("login.enter")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
