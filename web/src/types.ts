export type Category = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

export type AxiomEntry = {
  sleep_hours: number | string;
  weight_kg: number | string;
  mood: number | string;
  energy: number | string;
  expense: number | string;
  income: number | string;
  job_applications: number | string;
  interviews: number | string;
  english_minutes: number | string;
  exercise_minutes: number | string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snacks: string;
  diet_summary: string;
  notes: string;
  updated_at?: string;
};

export type EntryField = keyof Omit<AxiomEntry, "updated_at">;

export type AxiomTask = {
  task_id: string;
  category_id: string;
  title: string;
  target_value: number;
  actual_value: number;
  unit: string;
  done: number | boolean;
  sort_order: number;
};

export type AxiomDay = {
  date: string;
  entry: AxiomEntry;
  tasks: AxiomTask[];
};

export type RateStat = {
  total: number;
  done: number;
  rate: number;
};

export type TimelinePoint = RateStat & {
  date: string;
  englishMinutes: number;
  exerciseMinutes: number;
  jobApplications: number;
  interviews: number;
  expense: number;
  income: number;
  sleepHours: number;
  mood: number;
  energy: number;
  hasDiet: number;
};

export type CategoryStat = Category &
  RateStat & {
    sort_order?: number;
  };

export type Dashboard = {
  today: RateStat;
  streak: number;
  thirtyDays: RateStat;
  timeline: TimelinePoint[];
  categories: CategoryStat[];
  recentDays: Array<{ date: string } & RateStat>;
  metrics: {
    english7d: number;
    exercise7d: number;
    jobs7d: number;
    interviews7d: number;
    expense30d: number;
    income30d: number;
    avgSleep7d: number;
    avgMood7d: number;
    avgEnergy7d: number;
  };
  signals: {
    strongest: CategoryStat | null;
    weakest: CategoryStat | null;
  };
};

export type BootstrapPayload = {
  categories: Category[];
  day: AxiomDay;
  dashboard: Dashboard;
};

export type SavePayload = {
  ok: true;
  day: AxiomDay;
  dashboard: Dashboard;
  markdownPath: string;
  schemaMarkdownPath: string;
};

export type ExportPayload = {
  ok: true;
  markdownPath: string;
  schemaMarkdownPath: string;
};

export type CurrentStateDocument = {
  relativePath: string;
  updatedAt: string | null;
  content: string;
};

export type CurrentStatePayload = {
  ok: true;
  warnings: string[];
  currentState: CurrentStateDocument;
  masterSystemPrompt: CurrentStateDocument;
};

export type AuthConfigPayload = {
  ok: true;
  authEnabled: boolean;
  altchaEnabled: boolean;
  sessionTtlLabel: string;
};

export type BrandConfigPayload = {
  ok: true;
  brandName: string;
  tagline: string;
};

export type DocMeta = {
  id: string;
  title: string;
  section: string;
  summary: string;
  relativePath: string;
  updatedAt: string | null;
  sensitive: boolean;
  kind: "markdown" | "daily";
  date?: string;
};

export type DocsPayload = {
  docs: DocMeta[];
};

export type DocPayload = DocMeta & {
  content: string;
  excerpt: string;
};
