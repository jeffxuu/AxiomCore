import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { loadAuthConfig } from "@/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrand } from "@/lib/brandConfig";
import "altcha";

export function LoginPage() {
  const brand = useBrand();
  const [altchaEnabled, setAltchaEnabled] = useState(false);
  const [sessionTtlLabel, setSessionTtlLabel] = useState("8 小时");
  const [configError, setConfigError] = useState("");

  const urlError = new URLSearchParams(window.location.search).get("error") ?? "";

  useEffect(() => {
    loadAuthConfig()
      .then((payload) => {
        setAltchaEnabled(Boolean(payload.altchaEnabled));
        setSessionTtlLabel(payload.sessionTtlLabel);
      })
      .catch((exc: unknown) => {
        setConfigError(exc instanceof Error ? exc.message : "登录配置读取失败");
      });
  }, []);

  const errorMessage = configError || urlError;

  return (
    <Card className="w-full max-w-[480px] border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="space-y-4 pb-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
          <LockKeyhole className="size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl">{brand.brandName}</CardTitle>
          <CardDescription>登录后进入今日行动、历史记录、资料库和 AI 复盘。</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <form method="post" action="/api/login" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">账号</Label>
            <Input id="username" name="username" autoComplete="username" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {altchaEnabled ? (
            <altcha-widget
              challenge="/api/altcha"
              name="altcha"
              auto="onload"
              hidefooter
              style={{
                "--altcha-max-width": "100%",
                "--altcha-border-radius": "var(--radius)",
                "--altcha-border-color": "hsl(var(--border))",
                "--altcha-color-base": "transparent",
                "--altcha-padding": "10px 12px",
                "--altcha-shadow": "none",
              } as React.CSSProperties}
            />
          ) : null}
          {errorMessage ? (
            <Alert variant="destructive" className="py-2">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <Button className="w-full" type="submit">登录</Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          登录有效期 {sessionTtlLabel}。到期后需要重新登录。
        </p>
      </CardContent>
    </Card>
  );
}
