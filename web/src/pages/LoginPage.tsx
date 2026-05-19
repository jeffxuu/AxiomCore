import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { loadAuthConfig } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrand } from "@/lib/brandConfig";
import { useT } from "@/lib/i18nConfig";
import "altcha";

export function LoginPage() {
  const t = useT();
  const brand = useBrand();
  const [altchaEnabled, setAltchaEnabled] = useState(false);
  const [sessionTtlLabel, setSessionTtlLabel] = useState("8h");
  const [configError, setConfigError] = useState("");

  const urlError = new URLSearchParams(window.location.search).get("error") ?? "";

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

  const errorMessage = configError || urlError;

  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-7 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md border border-border bg-[var(--accent)] text-foreground">
          <LockKeyhole className="size-4" />
        </span>
        <div>
          <h1 className="text-base font-semibold tracking-tight">{brand.brandName}</h1>
          <p className="text-[12px] text-muted-foreground">{t("brand.tagline")}</p>
        </div>
      </div>

      <form method="post" action="/api/login" className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("login.username")}
          </Label>
          <Input id="username" name="username" autoComplete="username" required autoFocus className="h-9 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("login.password")}
          </Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-9 rounded-md" />
        </div>
        {altchaEnabled ? (
          <altcha-widget
            challenge="/api/altcha"
            name="altcha"
            auto="onload"
            hidefooter
            style={{
              "--altcha-max-width": "100%",
              "--altcha-border-radius": "8px",
              "--altcha-border-color": "var(--border)",
              "--altcha-color-base": "transparent",
              "--altcha-padding": "8px 12px",
              "--altcha-shadow": "none",
            } as React.CSSProperties}
          />
        ) : null}
        {errorMessage ? (
          <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3 py-2 text-[12px] text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}
        <Button type="submit" className="h-9 w-full rounded-md bg-foreground text-background hover:bg-foreground/90">
          {t("login.submit")}
        </Button>
      </form>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        {t("login.session", { x: sessionTtlLabel })}
      </p>
    </div>
  );
}
