import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { probeAuth } from "@/api";
import { useT } from "@/lib/i18nConfig";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { DecisionsPage } from "@/pages/DecisionsPage";
import { LedgerPage } from "@/pages/LedgerPage";
import { InsightsPage } from "@/pages/InsightsPage";
import { VaultPage } from "@/pages/VaultPage";
import { OraclePage } from "@/pages/OraclePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { LoginPage } from "@/pages/LoginPage";

type RouteState = { path: string; search: string };
type AuthStatus = "checking" | "authenticated" | "anonymous";

function AuthSplash() {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <span className="text-sm">{t("shell.auth.checking")}</span>
    </div>
  );
}

function App() {
  const [route, setRoute] = useState<RouteState>(() => ({
    path: window.location.pathname || "/",
    search: window.location.search,
  }));
  const [status, setStatus] = useState("Live");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");

  const isLoginRoute = route.path === "/login";

  useEffect(() => {
    const onPop = () => setRoute({ path: window.location.pathname || "/", search: window.location.search });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((href: string) => {
    window.history.pushState({}, "", href);
    setRoute({ path: window.location.pathname || "/", search: window.location.search });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (isLoginRoute) {
      setAuthStatus("anonymous");
      return () => {
        cancelled = true;
      };
    }
    setAuthStatus("checking");
    probeAuth()
      .then((payload) => {
        if (cancelled) return;
        if (payload.authenticated) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("anonymous");
          window.location.replace("/login");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAuthStatus("anonymous");
        window.location.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoginRoute]);

  if (isLoginRoute) {
    return (
      <AppShell isLogin path={route.path} status={status} navigate={navigate}>
        <LoginPage />
      </AppShell>
    );
  }

  if (authStatus !== "authenticated") {
    return <AuthSplash />;
  }

  const content = (() => {
    if (route.path === "/" || route.path === "/app") return <DashboardPage navigate={navigate} onStatus={setStatus} />;
    if (route.path === "/projects") return <ProjectsPage onStatus={setStatus} />;
    if (route.path === "/decisions") return <DecisionsPage onStatus={setStatus} />;
    if (route.path === "/ledger") return <LedgerPage onStatus={setStatus} />;
    if (route.path === "/insights") return <InsightsPage onStatus={setStatus} />;
    if (route.path === "/vault" || route.path === "/files" || route.path === "/library") {
      return <VaultPage selectedId={new URLSearchParams(route.search).get("doc") || undefined} navigate={navigate} />;
    }
    if (route.path === "/oracle" || route.path === "/ai") return <OraclePage onStatus={setStatus} />;
    if (route.path === "/settings" || route.path === "/more") return <SettingsPage navigate={navigate} />;
    return <DashboardPage navigate={navigate} onStatus={setStatus} />;
  })();

  return (
    <AppShell isLogin={false} path={route.path} status={status} navigate={navigate}>
      {content}
    </AppShell>
  );
}

export default App;
