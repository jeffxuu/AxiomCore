import {
  Boxes,
  ChevronRight,
  Compass,
  FileCog,
  KeyRound,
  LogOut,
  Network,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/axiom/PageHeader";
import { useBrand } from "@/lib/brandConfig";

type MoreEntry = {
  title: string;
  detail: string;
  Icon: LucideIcon;
  onSelect: () => void;
  hint?: string;
};

type MoreGroup = {
  label: string;
  description?: string;
  items: MoreEntry[];
};

function EntryRow({ title, detail, Icon, onSelect, hint }: MoreEntry) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-foreground/5 group-hover:text-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">{detail}</span>
      </span>
      {hint ? <span className="hidden text-xs text-muted-foreground sm:inline">{hint}</span> : null}
      <ChevronRight className="size-4 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

function GroupCard({ label, description, items }: MoreGroup) {
  return (
    <section>
      <header className="mb-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground/80">{description}</p> : null}
      </header>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {items.map((item) => (
              <li key={item.title}>
                <EntryRow {...item} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

export function MorePage({ navigate }: { navigate: (href: string) => void }) {
  const brand = useBrand();
  const groups: MoreGroup[] = [
    {
      label: `${brand.brandName} 产品`,
      description: "定位、人生域模型、决策引擎与路线图。",
      items: [
        {
          title: "产品愿景",
          detail: `${brand.brandName} 解决什么、不做什么、当前阶段。`,
          Icon: Compass,
          onSelect: () => navigate("/files?doc=product-vision"),
        },
        {
          title: "人生域模型",
          detail: "8 大域与物理目录的映射；第 9 域的预留。",
          Icon: Boxes,
          onSelect: () => navigate("/files?doc=life-domain-model"),
        },
        {
          title: "决策引擎",
          detail: "Burn Rate、ROI 三维评估、硬性否决规则。",
          Icon: Target,
          onSelect: () => navigate("/files?doc=decision-engine"),
        },
        {
          title: "AI Agent 行为规约",
          detail: "Axiom Core 首席决策官的人设与边界。",
          Icon: Sparkles,
          onSelect: () => navigate("/files?doc=ai-agent"),
        },
        {
          title: "Roadmap",
          detail: "近期、季度、年度的演进路线与已搁置项。",
          Icon: ScrollText,
          onSelect: () => navigate("/files?doc=roadmap"),
        },
      ],
    },
    {
      label: `${brand.brandName} 系统`,
      description: "系统架构、数据流与数据模型。",
      items: [
        {
          title: "系统架构",
          detail: "前后端分层、本地/云端拓扑、数据流向。",
          Icon: Network,
          onSelect: () => navigate("/files?doc=architecture"),
        },
        {
          title: "数据流",
          detail: "飞书 → 云端 → 本地 → GitHub 的多端流转。",
          Icon: FileCog,
          onSelect: () => navigate("/files?doc=data-flow"),
        },
        {
          title: "数据模型",
          detail: "SQLite、Markdown frontmatter、JSON Schema 三层对齐。",
          Icon: Boxes,
          onSelect: () => navigate("/files?doc=data-model"),
        },
      ],
    },
    {
      label: "运维与安全",
      description: "部署、日常运维、安全与隐私边界。",
      items: [
        {
          title: "安全与隐私",
          detail: "Public 仓库下的脱敏规则与本地凭据存储。",
          Icon: ShieldCheck,
          onSelect: () => navigate("/files?doc=security"),
        },
        {
          title: "部署说明",
          detail: "面向产品视角的部署流程与回滚。",
          Icon: Server,
          onSelect: () => navigate("/files?doc=deployment"),
        },
        {
          title: "日常运维",
          detail: "本地服务、定时任务、日志与故障排查。",
          Icon: Settings,
          onSelect: () => navigate("/files?doc=operations"),
        },
      ],
    },
    {
      label: "高级配置",
      description: "需要时再打开的低频功能。",
      items: [
        {
          title: "模型与 API Key",
          detail: "在 AI 页的「高级设置」中配置模型与密钥。",
          Icon: KeyRound,
          onSelect: () => navigate("/ai"),
          hint: "前往 AI 页",
        },
        {
          title: "主题与外观",
          detail: "主题切换在顶部导航的月亮/太阳按钮。",
          Icon: Settings,
          onSelect: () => navigate("/app"),
          hint: "顶部导航",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex gap-4 p-5 sm:p-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Sparkles className="size-5" />
          </span>
          <PageHeader eyebrow="More" title="更多">
            <p>系统设置、部署说明、账户操作和低频功能集中在这里，今日页保持专注。</p>
          </PageHeader>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((group) => (
          <GroupCard key={group.label} {...group} />
        ))}
      </div>

      <section>
        <header className="mb-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">账户</h2>
          <p className="mt-1 text-xs text-muted-foreground/80">登出后需要重新输入账号密码。</p>
        </header>
        <Card className="overflow-hidden border-destructive/30">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <LogOut className="size-4" />
              </span>
              <div className="min-w-0">
                <strong className="block text-sm font-medium text-foreground">退出登录</strong>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">离开云端 {brand.brandName}，回到登录页。</span>
              </div>
            </div>
            <form method="post" action="/api/logout">
              <Button variant="destructive" type="submit" size="sm">退出</Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
