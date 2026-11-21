// 季節イベント：季節ごとの限定スタンプと表示名。
export type Season = {
  id: "spring" | "summer" | "autumn" | "winter";
  name: string;
  stampId: string;
};

export function currentSeason(date: Date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return { id: "spring", name: "春", stampId: "sakura" };
  if (m >= 6 && m <= 8) return { id: "summer", name: "夏", stampId: "sun" };
  if (m >= 9 && m <= 11) return { id: "autumn", name: "秋", stampId: "momiji" };
  return { id: "winter", name: "冬", stampId: "snow" };
}
