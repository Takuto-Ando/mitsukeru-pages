// 今日のおでかけプラン（My Day）：日付ごとに「今日見たい動物」を保存する。
const KEY = "zooketch-myday-v1";

type StoredPlan = { date: string; groupIds: string[] };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadPlan(): string[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem(KEY) ?? "null",
    ) as StoredPlan | null;
    if (raw && raw.date === todayKey() && Array.isArray(raw.groupIds))
      return raw.groupIds;
  } catch {
    // 壊れていたら空プラン
  }
  return [];
}

export function savePlan(groupIds: string[]) {
  try {
    const stored: StoredPlan = { date: todayKey(), groupIds };
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // 保存できなくても表示は続けられる
  }
}
