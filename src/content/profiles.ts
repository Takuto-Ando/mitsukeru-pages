import type { Stroke, Evaluation } from "../types";
export interface Profile {
  part: string;
  question: string;
  next: string;
  background: string;
  answer: string;
  cue: "vertical" | "curve" | "paired" | "marks" | "outline";
  hint: string;
}
// Proposed tasks, not verified transcriptions of the original 提供資料 cards.
export const profiles: Record<string, Profile> = {
  mandrill: {
    part: "鼻の両側の溝",
    question: "鼻の両側に、どんな向きの溝が並ぶ？",
    next: "大人と子どもで顔の色は違うかな？",
    background:
      "M180 310Q110 190 190 90Q300 20 410 90Q490 190 420 310M290 100L280 250Q300 280 320 250L310 100",
    answer: "M205 130L190 230M230 120L220 245M370 120L380 245M395 130L410 230",
    cue: "paired",
    hint: "鼻の左右を見くらべてみよう。",
  },
  gibbon: {
    part: "枝に伸ばす長い腕",
    question: "枝に手を伸ばした腕の長さと曲がり方は？",
    next: "枝から移動するとき、どちらの腕を先に出す？",
    background:
      "M50 65L550 65M250 200Q300 170 350 200L345 320L255 320ZM270 155a35 35 0 1 0 60 0a35 35 0 1 0 -60 0",
    answer: "M255 220Q170 180 120 75M345 220Q420 170 475 75",
    cue: "paired",
    hint: "からだから枝まで、腕の線をたどってみよう。",
  },
  lemur: {
    part: "目のまわりの模様",
    question: "目のまわりの色の境目はどんな形？",
    next: "左右の目のまわりは同じ形に見える？",
    background:
      "M160 130L130 55L235 100Q300 70 365 100L470 55L440 130Q460 300 300 340Q140 300 160 130M280 290L320 290L300 310Z",
    answer:
      "M200 165Q245 120 270 190Q240 235 200 210ZM330 190Q355 120 400 165L400 210Q360 235 330 190Z",
    cue: "paired",
    hint: "瞳だけでなく、まわりの暗い部分を見よう。",
  },
  elephant: {
    part: "頭から続く鼻",
    question: "長い鼻はどこから伸びて、どう曲がる？",
    next: "鼻の先で何をつかめるかな？",
    background:
      "M180 300Q90 280 90 170Q100 70 220 80Q300 30 380 90Q520 80 510 200Q500 300 410 300M220 175L230 175M370 175L380 175",
    answer:
      "M275 190Q260 260 270 330Q300 390 365 330L350 310Q310 350 310 315L325 190",
    cue: "vertical",
    hint: "頭から鼻の先まで線でたどってみよう。",
  },
  capuchin: {
    part: "巻きつく尾",
    question: "尾の先は、どんなふうに巻いている？",
    next: "尾を枝に巻くと、手は何をしている？",
    background:
      "M200 160Q120 120 120 220Q160 310 270 260L330 160M200 150a45 45 0 1 0 70 -40a45 45 0 1 0 -70 40M380 70L380 330",
    answer:
      "M260 260Q440 360 465 200Q470 110 400 130Q350 150 385 190Q420 210 425 175",
    cue: "curve",
    hint: "尾の付け根から先まで、曲がり方を見よう。",
  },
  macaque: {
    part: "お尻の毛の境目",
    question: "お尻の毛のないところは、どんな輪郭？",
    next: "座ったとき、その部分はどこにくる？",
    background:
      "M170 100Q300 40 430 100L460 290M140 290L170 100M220 300L200 365M380 300L400 365",
    answer:
      "M285 190Q200 130 190 220Q190 285 285 260ZM315 190Q400 130 410 220Q410 285 315 260Z",
    cue: "paired",
    hint: "左右の部分を分けて見てみよう。",
  },
  badger: {
    part: "顔の縦の模様",
    question: "目を通る暗い模様は、どちらへ伸びる？",
    next: "鼻先と耳の近くで模様はどう変わる？",
    background:
      "M170 150Q100 70 195 85Q300 30 405 85Q500 70 430 150L365 310L300 345L235 310ZM280 310L320 310",
    answer: "M190 115Q215 180 275 295M410 115Q385 180 325 295",
    cue: "paired",
    hint: "目から鼻先へ、模様をたどってみよう。",
  },
  zebra: {
    part: "ひづめの外側",
    question: "足先を包むひづめのふちは、どんな形？",
    next: "足を上げたとき、先の形も見えるかな？",
    background: "M250 40L245 210M350 40L355 210M120 340L480 340",
    answer: "M245 210Q205 250 195 325L405 325Q395 250 355 210Z",
    cue: "outline",
    hint: "足先の下と左右の輪郭を見よう。",
  },
  giraffe: {
    part: "食べるときの舌",
    question: "口から伸びる舌の長さと曲がり方は？",
    next: "葉を取るとき、舌はどこへ動く？",
    background:
      "M160 70L200 120L370 120L450 200Q410 245 290 245L230 340M220 170L230 170M470 70L500 250",
    answer:
      "M405 220Q500 255 475 310Q440 345 410 300L430 285Q455 320 455 290Q450 265 390 250",
    cue: "curve",
    hint: "葉を取る瞬間、舌の先まで見よう。",
  },
  hippo: {
    part: "水面に出る鼻の穴",
    question: "水面近くで鼻の穴はどこに見える？",
    next: "目や耳も水の上に出ているかな？",
    background:
      "M130 240Q90 120 190 100L410 100Q510 120 470 240M60 260Q170 235 300 260T540 260M185 115L185 125M415 115L415 125",
    answer:
      "M225 180a18 12 0 1 0 36 0a18 12 0 1 0 -36 0M339 180a18 12 0 1 0 36 0a18 12 0 1 0 -36 0",
    cue: "paired",
    hint: "顔の上側にある二つの穴を探そう。",
  },
  fennec: {
    part: "足先の輪郭",
    question: "足先の丸みや指の境目はどう見える？",
    next: "歩いたとき、地面に触れるところはどこ？",
    background: "M245 50L240 180M355 50L360 180M130 340L470 340",
    answer:
      "M240 180Q185 230 200 310Q250 340 300 315Q350 340 400 310Q415 230 360 180M260 270L260 315M340 270L340 315",
    cue: "outline",
    hint: "足先を囲む線と指の境目を見よう。",
  },
  gorilla: {
    part: "頭の上の輪郭",
    question: "頭のてっぺんから額へ、どんな線になる？",
    next: "見る向きを変えると頭の形はどう見える？",
    background:
      "M170 180L150 280Q300 370 450 280L430 180M220 230Q300 200 380 230M250 290L350 290",
    answer: "M170 180Q175 110 235 90L295 55L330 100Q415 110 430 180",
    cue: "outline",
    hint: "頭のてっぺんを、横からも観察しよう。",
  },
  donkey: {
    part: "背中の線",
    question: "背中の中央と肩に、どんな線が見える？",
    next: "向きを変えると肩の線はつながって見える？",
    background:
      "M100 160Q300 90 500 160L490 290Q300 340 110 290ZM160 160L140 80M180 150L180 70",
    answer: "M145 225L465 225M225 135L225 310",
    cue: "marks",
    hint: "背中を通る線と肩の線を見てみよう。",
  },
  meerkat: {
    part: "目のまわりの暗い模様",
    question: "目のまわりの模様は、どの方向に広がる？",
    next: "顔を横に向けると模様はどう見える？",
    background:
      "M180 150Q140 65 215 105Q300 50 385 105Q460 65 420 150L370 300L300 330L230 300ZM280 295L320 295",
    answer:
      "M195 180Q230 145 270 180Q245 215 195 200ZM330 180Q370 145 405 180L405 200Q355 215 330 180Z",
    cue: "paired",
    hint: "目の小さな点と、そのまわりの色を分けて見よう。",
  },
  deer: {
    part: "背中の白い模様",
    question: "今の季節、背中にどんな模様が見える？",
    next: "季節が変わると模様はどう変わるかな？",
    background: "M90 180Q300 90 510 180L490 290Q300 330 110 290Z",
    answer:
      "M180 190l12 0M250 175l12 0M330 175l12 0M410 195l12 0M210 255l12 0M295 240l12 0M380 255l12 0",
    cue: "marks",
    hint: "白い点がない季節もあるよ。見えたままを描こう。",
  },
};
export function evaluateProfile(
  strokes: Stroke[],
  profile: Profile,
): Evaluation {
  const points = strokes
    .flat()
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const width = points.length
    ? Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
    : 0;
  const height = points.length
    ? Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))
    : 0;
  // These proposed tasks have no validated automatic classifier. Feature cues
  // drive the question, not a false positive label based on arbitrary geometry.
  return {
    passed: false,
    status: "uncertain",
    message: points.length
      ? "実物でも、こんな形に見えた？"
      : "見えた特徴を描いてみよう。",
    suggestion: profile.hint,
    debug: {
      cue: profile.cue,
      width,
      height,
      strokes: strokes.length,
      automaticJudging: "unvalidated",
    },
  };
}
