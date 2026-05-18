import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, BookOpen, Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useBrand } from "@/lib/brandConfig";
import { loadBootstrap, loadDoc, loadDocs, probeAuth } from "@/api";
import { AiPage } from "@/pages/AiPage";
import { DailyPage } from "@/pages/DailyPage";
import { DocPage } from "@/pages/DocPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { LoginPage } from "@/pages/LoginPage";
import { MorePage } from "@/pages/MorePage";
import { TodayPage } from "@/pages/TodayPage";
import type { BootstrapPayload, DocMeta, DocPayload } from "@/types";

type RouteState = {
  path: string;
  search: string;
};

type AuthStatus = "checking" | "authenticated" | "anonymous";

function localDateText(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sectionOrder(section: string): number {
  const order = [
    "总档案",
    "90 天计划",
    "文件与补充",
    "Axiom Core 产品",
    "Axiom Core 系统",
    "运维与安全",
    "系统说明",
    "每日记录",
    "归档",
  ];
  const index = order.indexOf(section);
  return index === -1 ? order.length : index;
}

function AuthSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-950 text-[11px] font-semibold tracking-[0.18em] text-white shadow-sm dark:bg-white dark:text-slate-950">
          OS
        </span>
        <span className="text-sm text-muted-foreground">正在校验登录状态…</span>
      </div>
    </div>
  );
}

function App() {
  const brand = useBrand();
  const [route, setRoute] = useState<RouteState>(() => ({
    path: window.location.pathname || "/",
    search: window.location.search,
  }));
  const [date, setDate] = useState(localDateText());
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [docCache, setDocCache] = useState<Record<string, DocPayload>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(`连接 ${brand.brandName}`);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const stored = localStorage.getItem("lifeos-theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // Ignore storage failures.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const isLoginRoute = route.path === "/login";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("lifeos-theme", theme);
    } catch {
      // Ignore storage failures.
    }
  }, [theme]);

  useEffect(() => {
    const onPop = () => setRoute({ path: window.location.pathname || "/", search: window.location.search });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((href: string) => {
    window.history.pushState({}, "", href);
    setRoute({ path: window.location.pathname || "/", search: window.location.search });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Auth gate: every page load probes /api/auth/me before rendering protected
    // UI. While the probe is in-flight we show a neutral splash so unauthenticated
    // users never see protected content flash onto the screen.
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

  const refreshBootstrap = useCallback(async (nextDate: string) => {
    try {
      setLoading(true);
      setError("");
      setStatus("同步中");
      const payload = await loadBootstrap(nextDate);
      setBootstrap(payload);
      setStatus("已同步");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "数据读取失败");
      setStatus("同步失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void refreshBootstrap(date);
  }, [date, authStatus, refreshBootstrap]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    loadDocs()
      .then((payload) => setDocs(payload.docs))
      .catch((exc: unknown) => setError(exc instanceof Error ? exc.message : "资料库读取失败"));
  }, [authStatus]);

  const getDoc = useCallback(async (id: string) => {
    const cached = docCache[id];
    if (cached) return cached;
    const payload = await loadDoc(id);
    setDocCache((current) => ({ ...current, [id]: payload }));
    return payload;
  }, [docCache]);

  const sortedDocs = useMemo(() => {
    return [...docs].sort((a, b) => {
      const sectionDelta = sectionOrder(a.section) - sectionOrder(b.section);
      if (sectionDelta !== 0) return sectionDelta;
      if (a.kind === "daily" && b.kind === "daily") return String(b.date).localeCompare(String(a.date));
      return a.title.localeCompare(b.title, "zh-CN");
    });
  }, [docs]);

  const selectedDoc = new URLSearchParams(route.search).get("doc") || undefined;

  if (isLoginRoute) {
    return (
      <AppShell
        isLogin
        path={route.path}
        status={status}
        theme={theme}
        navigate={navigate}
        onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")}
      >
        <LoginPage />
      </AppShell>
    );
  }

  if (authStatus !== "authenticated") {
    // Either still probing or already redirecting to /login. Either way, no
    // protected UI must render here.
    return <AuthSplash />;
  }

  const content = (() => {
    if (route.path === "/" || route.path === "/app") {
      return (
        <TodayPage
          bootstrap={bootstrap}
          date={date}
          docs={sortedDocs}
          error={error}
          loading={loading}
          navigate={navigate}
          onDateChange={setDate}
          onRefresh={() => refreshBootstrap(date)}
          onBootstrapChange={setBootstrap}
        />
      );
    }
    if (route.path === "/daily") {
      return <DailyPage docs={sortedDocs} selectedId={selectedDoc} getDoc={getDoc} navigate={navigate} />;
    }
    if (route.path === "/files" || route.path === "/library") {
      return <DocumentsPage docs={sortedDocs} selectedId={selectedDoc} getDoc={getDoc} navigate={navigate} />;
    }
    if (route.path === "/ai") return <AiPage />;
    if (route.path === "/profile") {
      return <DocPage docId="profile" getDoc={getDoc} icon={BookOpen} title="个人总档案" />;
    }
    if (route.path === "/plan-90") {
      return <DocPage docId="plan-90" getDoc={getDoc} icon={Target} title="90 天行动计划" />;
    }
    if (route.path === "/more") return <MorePage navigate={navigate} />;
    return <DocPage docId="roadmap" getDoc={getDoc} icon={Archive} title={`${brand.brandName} 系统说明`} />;
  })();

  return (
    <AppShell
      isLogin={false}
      path={route.path}
      status={status}
      theme={theme}
      navigate={navigate}
      onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")}
    >
      {content}
    </AppShell>
  );
}

export default App;
