type Translate = (key: string) => string;

const DOMAIN_INDEX_BY_ALIAS: Record<string, string> = {
  "01": "01",
  "01_health": "01",
  "02": "02",
  "02_cashflow": "02",
  "03": "03",
  "03_career": "03",
  "04": "04",
  "04_skills": "04",
  "05": "05",
  "05_projects": "05",
  "06": "06",
  "06_cognition": "06",
  "07": "07",
  "07_relationships": "07",
  "08": "08",
  "08_decisions": "08",
  "09": "09",
  "09_principles": "09",
};

export const DOMAIN_IDS = [
  "01_health",
  "02_cashflow",
  "03_career",
  "04_skills",
  "05_projects",
  "06_cognition",
  "07_relationships",
  "08_decisions",
  "09_principles",
] as const;

export function domainIndex(id: string): string {
  const normalized = id.toLowerCase();
  return DOMAIN_INDEX_BY_ALIAS[normalized] ?? normalized.slice(0, 2);
}

export function domainName(id: string, t: Translate, fallback = id): string {
  const key = `domain.name.${domainIndex(id)}`;
  const localized = t(key);
  return localized === key ? fallback : localized;
}

export function domainLabel(id: string, t: Translate, fallback = id): string {
  const index = domainIndex(id);
  return `${index} · ${domainName(id, t, fallback)}`;
}
