import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const auditPhase = process.env.VISUAL_AUDIT_PHASE === "before" ? "before" : "after";
const outputDir = path.resolve(process.cwd(), "..", "output", "visual-audit");

const today = "2026-05-17";

const categories = [
  { id: "job", name: "求职", color: "blue", sort_order: 1 },
  { id: "health", name: "健康", color: "green", sort_order: 2 },
  { id: "learning", name: "学习", color: "amber", sort_order: 3 },
  { id: "finance", name: "财务", color: "slate", sort_order: 4 },
];

const day = {
  date: today,
  entry: {
    sleep_hours: 7.2,
    weight_kg: 72.8,
    mood: 8,
    energy: 7,
    expense: 86,
    income: 280,
    job_applications: 5,
    interviews: 1,
    english_minutes: 45,
    exercise_minutes: 32,
    breakfast: "燕麦、鸡蛋、黑咖啡",
    lunch: "鸡胸肉、米饭、蔬菜",
    dinner: "三文鱼沙拉",
    snacks: "酸奶",
    diet_summary: "整体清淡，蛋白质足够，晚餐控制较好。",
    notes: "上午完成简历优化，下午推进两轮投递，晚上做轻量复盘。",
  },
  tasks: [
    { task_id: "t1", category_id: "job", title: "投递 5 个高匹配岗位", target_value: 5, actual_value: 5, unit: "份", done: true, sort_order: 1 },
    { task_id: "t2", category_id: "job", title: "复盘一轮面试题", target_value: 1, actual_value: 1, unit: "组", done: true, sort_order: 2 },
    { task_id: "t3", category_id: "health", title: "力量训练或快走", target_value: 30, actual_value: 32, unit: "分钟", done: true, sort_order: 3 },
    { task_id: "t4", category_id: "learning", title: "英语听力精听", target_value: 45, actual_value: 45, unit: "分钟", done: true, sort_order: 4 },
    { task_id: "t5", category_id: "finance", title: "记录现金流", target_value: 1, actual_value: 0, unit: "次", done: false, sort_order: 5 },
  ],
};

const timeline = Array.from({ length: 30 }, (_, index) => {
  const dayIndex = index + 1;
  return {
    date: `2026-05-${String(dayIndex).padStart(2, "0")}`,
    total: 5,
    done: Math.min(5, 2 + (index % 4)),
    rate: Math.min(1, 0.46 + index * 0.015),
    englishMinutes: 20 + (index % 6) * 8,
    exerciseMinutes: index % 3 === 0 ? 0 : 25 + (index % 5) * 5,
    jobApplications: index % 5,
    interviews: index % 7 === 0 ? 1 : 0,
    expense: 60 + (index % 4) * 26,
    income: index % 9 === 0 ? 280 : 0,
    sleepHours: 6.4 + (index % 5) * 0.25,
    mood: 6 + (index % 4),
    energy: 6 + (index % 3),
    hasDiet: index % 2,
  };
});

const dashboard = {
  today: { total: 5, done: 4, rate: 0.8 },
  streak: 7,
  thirtyDays: { total: 138, done: 102, rate: 0.739 },
  timeline,
  categories: categories.map((category, index) => ({
    ...category,
    total: 12,
    done: 8 + index,
    rate: (8 + index) / 12,
  })),
  recentDays: timeline.slice(-7).map((point) => ({ date: point.date, total: point.total, done: point.done, rate: point.rate })),
  metrics: {
    english7d: 285,
    exercise7d: 168,
    jobs7d: 23,
    interviews7d: 3,
    expense30d: 2680,
    income30d: 6420,
    avgSleep7d: 7.1,
    avgMood7d: 7.6,
    avgEnergy7d: 7.2,
  },
  signals: {
    strongest: { ...categories[0], total: 12, done: 11, rate: 0.92 },
    weakest: { ...categories[3], total: 12, done: 7, rate: 0.58 },
  },
};

const docs = [
  {
    id: "profile",
    title: "个人总档案",
    section: "总档案",
    summary: "长期目标、能力结构、健康与现金流画像。",
    relativePath: "00_个人总档案/profile.md",
    updatedAt: "2026-05-17",
    sensitive: false,
    kind: "markdown",
  },
  {
    id: "plan-90",
    title: "90 天行动计划",
    section: "90 天计划",
    summary: "围绕求职、现金流、健康和学习的季度推进方案。",
    relativePath: "01_系统说明/plan-90.md",
    updatedAt: "2026-05-16",
    sensitive: false,
    kind: "markdown",
  },
  {
    id: "health-summary",
    title: "健康摘要",
    section: "文件与补充",
    summary: "睡眠、运动、饮食和身体状态摘要。",
    relativePath: "03_身体健康/summary.md",
    updatedAt: "2026-05-15",
    sensitive: false,
    kind: "markdown",
  },
  {
    id: "roadmap",
    title: "LifeOS 系统说明",
    section: "系统说明",
    summary: "记录流程、部署原则和长期维护方式。",
    relativePath: "01_系统说明/roadmap.md",
    updatedAt: "2026-05-14",
    sensitive: false,
    kind: "markdown",
  },
  {
    id: "daily-2026-05-17",
    title: "2026-05-17 每日记录",
    section: "每日记录",
    summary: "投递、运动、英语和现金流记录。",
    relativePath: "02_每日记录/2026-05-17.md",
    updatedAt: "2026-05-17",
    sensitive: false,
    kind: "daily",
    date: "2026-05-17",
  },
  {
    id: "daily-2026-05-16",
    title: "2026-05-16 每日记录",
    section: "每日记录",
    summary: "复盘简历与训练节奏。",
    relativePath: "02_每日记录/2026-05-16.md",
    updatedAt: "2026-05-16",
    sensitive: false,
    kind: "daily",
    date: "2026-05-16",
  },
] as const;

const markdown = `# 2026-05-17 每日记录

## 今日摘要

- 今日投递：5 份
- 英语学习：45 分钟
- 运动训练：32 分钟
- 睡眠：7.2 小时

## 复盘

今天的节奏更像一个成熟的个人操作系统：先处理关键行动，再记录指标，最后沉淀为 Markdown。

| 模块 | 数据 | 状态 |
| --- | ---: | --- |
| 求职 | 5 份投递 | 稳定 |
| 健康 | 32 分钟运动 | 达标 |
| 学习 | 45 分钟英语 | 达标 |
| 财务 | 净流入 194 元 | 待复盘 |
`;

async function mockApi(page: Page) {
  await page.route("**/api/bootstrap**", async (route) => {
    await route.fulfill({ json: { categories, day, dashboard } });
  });
  await page.route("**/api/docs", async (route) => {
    await route.fulfill({ json: { docs } });
  });
  await page.route("**/api/docs/**", async (route) => {
    const id = decodeURIComponent(route.request().url().split("/api/docs/")[1] ?? "profile");
    const meta = docs.find((doc) => doc.id === id) ?? docs[0];
    await route.fulfill({ json: { ...meta, content: markdown, excerpt: markdown.slice(0, 120) } });
  });
  await page.route("**/api/ai/models", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        models: [
          { id: "Pro/deepseek-ai/DeepSeek-V3.2", name: "DeepSeek V3.2", provider: "siliconflow" },
          { id: "gpt-4.1-mini", name: "GPT 4.1 mini", provider: "openai" },
        ],
      },
    });
  });
  await page.route("**/api/ai-analyze", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        reply: "今日行动完成度较高。建议明天优先处理现金流记录，并保留晚间 20 分钟复盘窗口。",
        model: "Pro/deepseek-ai/DeepSeek-V3.2",
        provider: "siliconflow",
        date: today,
        writtenTo: "02_每日记录/2026-05-17.md",
      },
    });
  });
  await page.route("**/api/ai/probe-key", async (route) => {
    await route.fulfill({ json: { ok: true, models: [{ id: "gpt-4.1-mini", name: "GPT 4.1 mini" }], total: 1 } });
  });
  await page.route("**/api/auth/config", async (route) => {
    await route.fulfill({ json: { ok: true, authEnabled: true, altchaEnabled: false, sessionTtlLabel: "7 天" } });
  });
  await page.route("**/api/altcha", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

async function saveScreenshot(page: Page, pathName: string, name: string) {
  await mockApi(page);
  await page.goto(pathName, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: path.join(outputDir, name), fullPage: false });
}

test.beforeAll(async () => {
  await mkdir(outputDir, { recursive: true });
});

if (auditPhase === "before") {
  test("capture app before desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await saveScreenshot(page, "/app", "app-desktop-before.png");
  });

  test("capture app before mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await saveScreenshot(page, "/app", "app-mobile-before.png");
  });
} else {
  test("capture app after desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await saveScreenshot(page, "/", "app-desktop-after.png");
  });

  test("capture app after mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await saveScreenshot(page, "/", "app-mobile-after.png");
  });

  test("capture ai after mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await saveScreenshot(page, "/ai", "ai-mobile-after.png");
    await expect(page.getByRole("button", { name: "高级设置" })).toBeVisible();
    await expect(page.getByText("API Key")).not.toBeVisible();
  });

  test("capture daily after mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await saveScreenshot(page, "/daily", "daily-mobile-after.png");
  });

  test("capture files after mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await saveScreenshot(page, "/files", "files-mobile-after.png");
  });

  test("capture login after mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await saveScreenshot(page, "/login", "login-mobile-after.png");
  });
}
