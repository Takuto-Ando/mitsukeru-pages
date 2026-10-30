import { materialTasks } from "./materialTasks";
import { observationHints } from "./hints";
import { fullBodyLayouts } from "./fullBodyLayouts";
import partScenes from "./partScenes";
import { groups } from "./groups";
import { scenes, type Scene } from "./scenes";
import { profiles, type Profile } from "./profiles";
export type JudgingMethod =
  | "orientation"
  | "curvature"
  | "proportion"
  | "placement"
  | "pattern"
  | "selfCheck";
export interface ObservationTask {
  id: string;
  groupId: string;
  part: string;
  question: string;
  hint: string;
  hints?: string[];
  next: string;
  method: JudgingMethod;
  automatic: boolean;
  allowAbsent?: boolean;
  comparisonNote?: string;
  scene: Scene;
  profile?: Profile;
  explanation: { name: string; form: string; ecology: string; role?: string };
  source?: string;
  sourceNote?: string;
}
const forms: Record<string, [string, string, string?]> = {
  mandrill: [
    "鼻の両側の溝",
    "大人のマンドリルの鼻は赤く、左右の青い部分には溝が並びます。顔の色は年齢や性別でも違います。",
    "森林で暮らし、果実や葉、昆虫などを食べます。",
  ],
  gibbon: [
    "長い腕",
    "顔のまわりと手足の先は白っぽい毛。長い腕で枝から枝へ移動します。",
    "地面を歩くときは両腕を広げてバランスをとります。",
  ],
  lemur: [
    "目を囲む模様",
    "目のまわりの暗い部分を、左右で見くらべよう。",
    "ワオキツネザルは木の上だけでなく地面にも降ります。尾の輪の模様が名前の由来です。",
  ],
  goat: [
    "横長の瞳孔",
    "瞳孔は、目に入る光の量を調節する黒い部分。ヤギでは横長です。",
    "横に広い視野で、草を食べながら周囲の動きに気づきやすくなります。",
  ],
  elephant: [
    "頭の二つのふくらみ",
    "アジアゾウの額は、上からたどると左右にふくらんで見えます。",
    "長い鼻を器用に使い、草や木の葉、果実などを食べます。頭の形も鼻の動きも見てみよう。",
  ],
  capuchin: [
    "巻きつく尾",
    "長い尾は、先を曲げてものをつかめます。",
    "尾で自分の体重を支えることもできます。枝をつかむ手と尾を見くらべてみよう。",
  ],
  macaque: [
    "お尻の毛の境目",
    "毛がある部分と少ない部分で、輪郭や色の見え方が変わります。",
    "アカゲザルは木の上と地面の両方で生活し、果実や若葉、昆虫などを食べます。",
  ],
  badger: [
    "顔を通る暗い帯",
    "鼻先と目の近くで、暗い毛の帯がどちらへ伸びるか見てみよう。",
    "前足の大きな爪で巣穴を掘ります。昼は穴で休み、日が沈むと活動します。",
  ],
  zebra: [
    "一つにまとまったひづめ",
    "シマウマの足先は、一つの大きなひづめで地面に触れます。",
    "硬いひづめが足先を包み、立ったり走ったりするときに体を支えます。",
  ],
  giraffe: [
    "長い舌",
    "口から出る舌を、先までたどってみよう。食べるときに曲がり方が変わります。",
    "キリンは長い舌で葉をつかんで食べます。食べる瞬間に、舌の曲がり方を見てみよう。",
  ],
  hippo: [
    "顔の上の鼻の穴",
    "目や耳、鼻の穴が顔の上の方に集まっています。水面との位置を見てみよう。",
    "カバは昼は水中や水辺で休み、夜に陸へ上がって草を食べます。",
  ],
  fennec: [
    "小さな足先",
    "足先を囲む毛と、指の境目を見てみよう。",
    "フェネックは砂漠に巣穴を掘り、昼の暑さや夜の冷気を避けます。",
  ],
  gorilla: [
    "頭の輪郭",
    "頭のてっぺんから額までを、ひとつながりの線でたどってみよう。見る向きでも形が変わります。",
    "ニシゴリラは熱帯雨林に暮らし、いろいろな植物や昆虫を食べます。",
  ],
  donkey: [
    "背中と肩の線",
    "背中を通る暗い線と、肩の線を見てみよう。濃さや見え方は個体で違います。",
    "ロバはアフリカノロバを家畜化して生まれたと考えられています。",
  ],
  meerkat: [
    "目のまわりの暗い模様",
    "目そのものと、そのまわりの暗い毛を分けて見てみよう。",
    "乾いた平原で穴を掘り、家族で暮らします。後ろ足で立って、まわりを見張ることもあります。",
  ],
  deer: [
    "季節で変わる斑点",
    "夏毛には白い斑点があり、冬毛では消えます。見えない季節も、見えたままに確かめよう。",
    "森林や草地に暮らし、木の芽や葉、草を食べます。",
  ],
};
const mode: Record<string, JudgingMethod> = {
  goat: "orientation",
  gibbon: "proportion",
  capuchin: "curvature",
  giraffe: "curvature",
  hippo: "placement",
  mandrill: "pattern",
  lemur: "pattern",
  badger: "pattern",
  donkey: "pattern",
  deer: "pattern",
  meerkat: "pattern",
};
export const tasks: ObservationTask[] = groups
  .filter((g) => !!forms[g.id])
  .map((g) => {
    const p = profiles[g.id];
    const [name, form, ecology] = forms[g.id];
    const scene =
      g.id === "elephant"
        ? {
            ...scenes.elephant,
            label: "頭の輪郭",
            regions: [
              {
                x: 170 / 600,
                y: 45 / 400,
                width: 260 / 600,
                height: 130 / 400,
              },
            ],
            answerPath:
              "M180 155Q190 70 240 75Q275 80 300 125Q325 80 365 75Q410 80 420 155",
          }
        : scenes[g.id];
    return {
      id: g.id,
      groupId: g.id,
      allowAbsent: g.id === "deer",
      comparisonNote:
        g.id === "deer"
          ? "お手本は夏の模様。いま見えた姿と見くらべよう。"
          : undefined,
      part: g.id === "elephant" ? "頭の輪郭" : p?.part || "瞳孔",
      question:
        g.id === "elephant"
          ? "頭のてっぺんは、どんなふうにふくらんでいる？"
          : p?.question || "目の黒い部分は、たてとよこ、どちらに長い？",
      hint: p?.hint || "黒い部分の横幅を見てみよう。",
      next: p?.next || "草を食べるとき、瞳孔の向きはどうなる？",
      method: mode[g.id] || "selfCheck",
      automatic: ["goat", "gibbon", "capuchin", "giraffe", "hippo"].includes(
        g.id,
      ),
      scene,
      profile: p,
      explanation: { name, form, ecology: ecology || "" },
      source: g.source,
      sourceNote:
        "形態の描画課題は本制作で設計。公式図鑑で確認した生態と、役割を確定していない形態の観察を区別する。",
    };
  });
function extra(
  groupId: string,
  id: string,
  part: string,
  question: string,
  hint: string,
  next: string,
  rect: number[],
  answerPath: string,
  form: string,
  ecology: string,
  source?: string,
) {
  const [x, y, width, height] = rect;
  tasks.push({
    id,
    groupId,
    part,
    question,
    hint,
    next,
    method: "selfCheck",
    automatic: false,
    scene: {
      id,
      label: part,
      regions: [
        { x: x / 600, y: y / 400, width: width / 600, height: height / 400 },
      ],
      answerPath,
    },
    explanation: { name: part, form, ecology },
    source,
  });
}
extra(
  "goat",
  "sheep",
  "ヒツジの瞳孔",
  "ヒツジの目の黒い部分は、どんな向き？",
  "目の中の横幅を見てみよう。",
  "ヤギの目と似ているところはどこ？",
  [190, 165, 230, 110],
  "M205 205Q305 190 405 205L405 235Q305 250 205 235Z",
  "ヒツジも横長の瞳孔を持ちます。ヤギと見くらべてみよう。",
  "瞳孔は、目に入る光の量を調節します。",
  "https://zoo.city.kyoto.lg.jp/zoo/animals/o_aries",
);
extra(
  "giraffe",
  "giraffe-hoof",
  "二つに分かれたひづめ",
  "足先の真ん中は、どう分かれている？",
  "左右のひづめの境目を見よう。",
  "シマウマの足先とはどう違う？",
  [190, 200, 220, 140],
  "M245 210Q205 250 200 325L290 325L300 255L310 325L400 325Q395 250 355 210",
  "キリンの足先には、二つに分かれたひづめがあります。",
  "硬いひづめに包まれた足先で、体を支えます。",
  groups.find((g) => g.id === "giraffe")!.source,
);
extra(
  "hippo",
  "hippo-body",
  "丸い背中の輪郭",
  "背中からお尻まで、どんなカーブ？",
  "大きく丸い背中をたどってみよう。",
  "水に入ると、体のどこまで見える？",
  [175, 75, 335, 120],
  "M185 180Q225 75 340 95Q465 85 500 180",
  "大きな胴体と短い足をしています。水面に出る部分を見てみよう。",
  "昼は水中や水辺で休み、夜に陸で草を食べます。",
  groups.find((g) => g.id === "hippo")!.source,
);
extra(
  "fennec",
  "fennec-tail",
  "ふさふさした尾",
  "尾はどのくらい長く、どう曲がっている？",
  "付け根から先の毛まで見よう。",
  "歩くときと休むときで尾の向きは違う？",
  [320, 200, 230, 150],
  "M330 225Q405 315 470 310L520 270Q455 285 395 235",
  "細い脚と見くらべると、尾の毛の広がりが見えます。",
  "フェネックは夜に活動し、小さな動物や昆虫などを食べます。",
  groups.find((g) => g.id === "fennec")!.source,
);
for (const m of materialTasks) {
  tasks.push({
    id: m.id,
    groupId: m.groupId,
    part: m.part,
    question: m.question,
    hint: m.hints[0],
    hints: m.hints,
    next: m.next,
    method: "selfCheck",
    automatic: false,
    allowAbsent: ["hippo-skin", "gorilla-back", "bear"].includes(m.id),
    comparisonNote:
      m.id === "gorilla-back"
        ? "お手本は大人のオス。いま見ている個体の毛の色と見くらべよう。"
        : m.id === "hippo-skin"
          ? "お手本の点は分泌液を表す模式図。実物にいつも見える模様ではありません。"
          : undefined,
    scene: {
      id: m.id,
      label: m.part,
      frameHeight: 600,
      regions: m.rects.map(([x, y, width, height]) => ({
        x: x / 600,
        y: y / 600,
        width: width / 600,
        height: height / 600,
      })),
      answerPath: m.answerPath,
      answerAsset: `illustrations/whole/${m.id}-complete.svg`,
    },
    explanation: m.explanation,
    source: m.source || groups.find((g) => g.id === m.groupId)?.source,
    sourceNote: `提供PDF ${m.page}ページのカードをもとに描画課題を設計。模様の働きの未検証説明は採用していない。`,
  });
}
export const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
export const tasksForGroup = (id: string) =>
  tasks.filter((t) => t.groupId === id);

// Position the missing part within a full-animal illustration, never a close-up.
for (const task of tasks) {
  if (materialTasks.some((m) => m.id === task.id)) continue;
  task.hints = observationHints[task.id];
  if (task.id === "sheep") {
    task.method = "orientation";
    task.automatic = true;
  }
  const layout = fullBodyLayouts[task.id];
  const prior = partScenes[task.id as keyof typeof partScenes];
  const rectangles =
    layout.windows ||
    prior.regions.map((r) => [
      r.x * 600,
      r.y * 400,
      r.width * 600,
      r.height * 400,
    ]);
  const region = ([x, y, width, height]: number[]) => ({
    x: (x * layout.scale + layout.x) / 600,
    y: (y * layout.scale + layout.y) / 600,
    width: (width * layout.scale) / 600,
    height: (height * layout.scale) / 600,
  });
  task.scene = {
    ...task.scene,
    frameHeight: 600,
    answerAsset: `illustrations/whole/${task.id}-complete.svg`,
    regions: rectangles.map(region),
    maskHoles: undefined,
  };
  if ("maskHoles" in prior && prior.maskHoles)
    task.scene.maskHoles = prior.maskHoles.map((r) =>
      region([r.x * 600, r.y * 400, r.width * 600, r.height * 400]),
    );
  if (layout.answerPath) task.scene.answerPath = layout.answerPath;
}
