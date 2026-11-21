import { groups, type ObservationGroup } from "../content/groups";
import type { ObservationRecord } from "../notebook/types";

// ---- 月替わり観察チャレンジ ---------------------------------------------

export type Challenge = {
  id: string;
  title: string;
  description: string;
  targetGroupIds: string[];
  goal: number;
};

export const CHALLENGES: Challenge[] = [
  {
    id: "nose",
    title: "お鼻コレクター",
    description: "鼻がとくちょうの動物を観察しよう",
    targetGroupIds: ["elephant", "tapir", "hippo"],
    goal: 3,
  },
  {
    id: "eyes",
    title: "目ヂカラ探検隊",
    description: "目の模様や瞳孔をよく見てみよう",
    targetGroupIds: ["lemur", "goat", "meerkat", "fennec"],
    goal: 3,
  },
  {
    id: "tails",
    title: "しっぽ追跡団",
    description: "しっぽの形と模様を観察しよう",
    targetGroupIds: ["capuchin", "lemur", "fennec"],
    goal: 2,
  },
  {
    id: "patterns",
    title: "もようハンター",
    description: "体の模様を描き分けよう",
    targetGroupIds: ["zebra", "deer", "bear", "mandrill"],
    goal: 3,
  },
  {
    id: "feet",
    title: "あしあと調査隊",
    description: "足先とひづめを観察しよう",
    targetGroupIds: ["zebra", "fennec", "bush-dog", "deer"],
    goal: 3,
  },
  {
    id: "faces",
    title: "お顔コレクター",
    description: "顔のとくちょうを集めよう",
    targetGroupIds: ["mandrill", "badger", "meerkat", "gorilla"],
    goal: 3,
  },
];

export function currentChallenge(date: Date = new Date()): Challenge {
  const index = (date.getFullYear() * 12 + date.getMonth()) % CHALLENGES.length;
  return CHALLENGES[index];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function challengeProgress(
  drawings: ObservationRecord[],
  date: Date = new Date(),
): { challenge: Challenge; done: number; complete: boolean } {
  const challenge = currentChallenge(date);
  const key = monthKey(date);
  const observed = new Set(
    drawings
      .filter((d) => d.createdAt.slice(0, 7) === key)
      .map((d) => d.groupId),
  );
  const done = challenge.targetGroupIds.filter((id) => observed.has(id)).length;
  return { challenge, done, complete: done >= challenge.goal };
}

// ---- 特徴バッジ -----------------------------------------------------------

export type FeatureBadge = {
  id: string;
  title: string;
  groupIds: string[];
  need: number;
};

export const FEATURE_BADGES: FeatureBadge[] = [
  { id: "nose", title: "鼻の名人", groupIds: ["elephant", "tapir", "hippo"], need: 2 },
  { id: "tail", title: "尾の名人", groupIds: ["capuchin", "lemur", "fennec"], need: 2 },
  { id: "eye", title: "目の名人", groupIds: ["lemur", "goat", "meerkat", "fennec"], need: 2 },
  { id: "pattern", title: "模様の名人", groupIds: ["zebra", "deer", "bear", "badger", "mandrill"], need: 3 },
  { id: "face", title: "顔の名人", groupIds: ["mandrill", "badger", "meerkat", "gorilla", "hippo"], need: 3 },
  { id: "foot", title: "足の名人", groupIds: ["zebra", "deer", "fennec", "bush-dog"], need: 2 },
];

export function badgeStatus(
  drawings: ObservationRecord[],
): { badge: FeatureBadge; count: number; earned: boolean }[] {
  const observed = new Set(drawings.map((d) => d.groupId));
  return FEATURE_BADGES.map((badge) => {
    const count = badge.groupIds.filter((id) => observed.has(id)).length;
    return { badge, count, earned: count >= badge.need };
  });
}

// ---- 次に観察したい動物 ---------------------------------------------------

export function nextAnimals(
  drawings: ObservationRecord[],
  count = 3,
): ObservationGroup[] {
  const observed = new Set(drawings.map((d) => d.groupId));
  return groups.filter((g) => !observed.has(g.id)).slice(0, count);
}

// ---- 月次集計（おうちレポート用） -----------------------------------------

export function monthStats(
  drawings: ObservationRecord[],
  date: Date = new Date(),
): {
  thisMonth: { cards: number; species: number };
  lastMonth: { cards: number; species: number };
} {
  const thisKey = monthKey(date);
  const last = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const lastKey = monthKey(last);
  const summarize = (key: string) => {
    const rows = drawings.filter((d) => d.createdAt.slice(0, 7) === key);
    return {
      cards: rows.length,
      species: new Set(rows.map((d) => d.groupId)).size,
    };
  };
  return { thisMonth: summarize(thisKey), lastMonth: summarize(lastKey) };
}

// ---- CSV 書き出し ----------------------------------------------------------

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function observationsToCsv(drawings: ObservationRecord[]): string {
  const header = ["日付", "動物", "課題", "解説"];
  const lines = [...drawings]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((d) =>
      [
        d.createdAt.slice(0, 10),
        d.animalName,
        d.taskName,
        d.explanation.form,
      ]
        .map(csvCell)
        .join(","),
    );
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}

// ---- 観察ビンゴ -------------------------------------------------------------

export type BingoCell = { label: string; groupIds: string[] };

export const BINGO_CELLS: BingoCell[] = [
  { label: "長い鼻", groupIds: ["elephant", "tapir"] },
  { label: "しま模様", groupIds: ["zebra", "badger"] },
  { label: "大きな耳", groupIds: ["fennec"] },
  { label: "巻き尾", groupIds: ["capuchin"] },
  { label: "長い首", groupIds: ["giraffe"] },
  { label: "ひづめ", groupIds: ["zebra", "deer", "goat"] },
  { label: "大きな目", groupIds: ["lemur", "meerkat"] },
  { label: "背中の模様", groupIds: ["deer", "bear", "tapir"] },
  { label: "水辺の動物", groupIds: ["hippo", "bush-dog"] },
];

const BINGO_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function bingoStatus(drawings: ObservationRecord[]): {
  cells: { cell: BingoCell; hit: boolean }[];
  lines: number;
} {
  const observed = new Set(drawings.map((d) => d.groupId));
  const cells = BINGO_CELLS.map((cell) => ({
    cell,
    hit: cell.groupIds.some((id) => observed.has(id)),
  }));
  const lines = BINGO_LINES.filter((line) =>
    line.every((i) => cells[i].hit),
  ).length;
  return { cells, lines };
}

// ---- 今日のミッションカード -------------------------------------------------

export function todaysMissions(
  drawings: ObservationRecord[],
  date: Date = new Date(),
): ObservationGroup[] {
  const seed =
    date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate();
  const pick = groups[seed % groups.length];
  const missions: ObservationGroup[] = [pick];
  for (const g of nextAnimals(drawings, groups.length)) {
    if (missions.length >= 3) break;
    if (g.id !== pick.id) missions.push(g);
  }
  return missions;
}
