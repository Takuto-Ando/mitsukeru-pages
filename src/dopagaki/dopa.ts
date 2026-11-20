// ドパガキモード（遊び用）: XP・レベル・モード設定の保存と管理。
// 観察データ本体の保存形式には一切触れない。localStorage の専用キーだけを使う。

export const DOPA_MODE_KEY = "zooketch-dopa-mode-v1";
export const DOPA_XP_KEY = "zooketch-dopa-xp-v1";
export const DOPA_SOUND_KEY = "zooketch-dopa-sound-v1";

const sessionValues = new Map<string, string>();

function read(key: string): string | null {
  const inSession = sessionValues.get(key);
  if (inSession !== undefined) return inSession;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    sessionValues.delete(key);
  } catch {
    sessionValues.set(key, value);
  }
}

export function loadDopaMode(defaultMode = false): boolean {
  const value = read(DOPA_MODE_KEY);
  return value === "1" || (value !== "0" && defaultMode);
}

export function saveDopaMode(on: boolean) {
  write(DOPA_MODE_KEY, on ? "1" : "0");
}

export function loadDopaSound(): boolean {
  return read(DOPA_SOUND_KEY) !== "0";
}

export function saveDopaSound(on: boolean) {
  write(DOPA_SOUND_KEY, on ? "1" : "0");
}

export function getXp(): number {
  const value = Number(read(DOPA_XP_KEY));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

// レベルは XP の平方根カーブ: Lv.n に必要な累計 XP = 40 * (n-1)^2
export function xpForLevel(level: number): number {
  return 40 * (level - 1) * (level - 1);
}

export function levelForXp(xp: number): number {
  return (
    Math.floor(Math.sqrt(Math.max(0, Number.isFinite(xp) ? xp : 0) / 40)) + 1
  );
}

export interface XpGain {
  xp: number;
  level: number;
  leveledUp: boolean;
}

export function addXp(amount: number): XpGain {
  const before = getXp();
  const prevLevel = levelForXp(before);
  const gain = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const xp = Math.min(Number.MAX_SAFE_INTEGER, before + gain);
  const level = levelForXp(xp);
  const result = { xp, level, leveledUp: level > prevLevel };
  if (gain > 0) {
    write(DOPA_XP_KEY, String(xp));
    window.dispatchEvent(new CustomEvent("dopa:xp", { detail: result }));
  }
  return result;
}

export const PRAISES = [
  "神ってる！",
  "天才あらわる！",
  "激アツ！目が離せない！",
  "レジェンド級の観察力！",
  "ピツネもびっくり！",
  "その線、輝いてる！",
  "動物園のスターだね！",
  "もうプロの絵描きさん！",
];

export function pickPraise(): string {
  return PRAISES[Math.floor(Math.random() * PRAISES.length)];
}
