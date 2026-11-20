// ドパガキモード（遊び用）: XP・レベル・モード設定の保存と管理。
// 観察データ本体の保存形式には一切触れない。localStorage の専用キーだけを使う。

export const DOPA_MODE_KEY = "zooketch-dopa-mode-v1";
export const DOPA_XP_KEY = "zooketch-dopa-xp-v1";
export const DOPA_SOUND_KEY = "zooketch-dopa-sound-v1";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 保存できなくても遊び機能は止めない
  }
}

export function loadDopaMode(): boolean {
  return read(DOPA_MODE_KEY) === "1";
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
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

// レベルは XP の平方根カーブ: Lv.n に必要な累計 XP = 40 * (n-1)^2
export function xpForLevel(level: number): number {
  return 40 * (level - 1) * (level - 1);
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
}

export interface XpGain {
  xp: number;
  level: number;
  leveledUp: boolean;
}

export function addXp(amount: number): XpGain {
  const before = getXp();
  const prevLevel = levelForXp(before);
  const xp = before + Math.max(0, Math.floor(amount));
  write(DOPA_XP_KEY, String(xp));
  const level = levelForXp(xp);
  window.dispatchEvent(new CustomEvent("dopa:xp", { detail: { xp, level } }));
  return { xp, level, leveledUp: level > prevLevel };
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
