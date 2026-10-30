import type { ObservationTask } from "./tasks";

/** Additional tasks transcribed from the 30 source cards (PDF pp. 11–20).
 * Questions are adapted for drawing. Functional explanations not verified by
 * primary sources are deliberately omitted; comparison is self-confirmed.
 */
export interface MaterialTask {
  id: string;
  groupId: string;
  page: number;
  part: string;
  question: string;
  hints: [string, string];
  next: string;
  rects: number[][];
  answerPath: string;
  base?: string;
  explanation: ObservationTask["explanation"];
  source?: string;
}
const zoo = "https://zoo.city.kyoto.lg.jp/zoo/animals/";
export const materialTasks: MaterialTask[] = [
  {
    id: "giraffe-lashes",
    groupId: "giraffe",
    page: 11,
    part: "まつ毛",
    base: "giraffe",
    question: "目の上のまつ毛は、どんな向きに伸びる？",
    hints: [
      "角や耳ではなく、目のすぐ上を探そう。",
      "まぶたから伸びる細い毛の長さを、顔の毛と見くらべよう。",
    ],
    next: "シマウマのまつ毛と、似ているところはあるかな？",
    rects: [[190, 110, 70, 60]],
    answerPath: "M208 133L197 119M220 130L216 111M232 133L241 116",
    explanation: {
      name: "目をふちどるまつ毛",
      form: "キリンのまぶたにも、長いまつ毛が並んでいます。",
      ecology: "葉を食べる顔を見ながら、目のまわりの細い毛も観察しよう。",
    },
    source: zoo + "g_camelopardalis",
  },

  {
    id: "zebra-lashes",
    groupId: "zebra",
    page: 11,
    part: "まつ毛",
    base: "zebra",
    question: "目のふちから、まつ毛はどちらへ伸びている？",
    hints: [
      "しま模様ではなく、目のすぐふちを見てみよう。",
      "まぶたの上の細い毛を、先までたどろう。",
    ],
    next: "キリンのまつ毛とも見くらべてみよう。",
    rects: [[108, 165, 65, 52]],
    answerPath: "M124 187L112 172M135 185L131 166M146 188L153 170",
    explanation: {
      name: "目のふちのまつ毛",
      form: "シマウマのまぶたには、長いまつ毛が並んでいます。",
      ecology: "目のまわりの毛と、顔のしま模様を分けて見てみよう。",
    },
  },
  {
    id: "gibbon-face",
    groupId: "gibbon",
    page: 12,
    part: "顔を囲む白い毛",
    base: "gibbon",
    question: "顔のまわりの明るい毛は、どんな形につながる？",
    hints: [
      "目や口の外側にある、毛の色の境目を探そう。",
      "おでこからほっぺ、あごへとたどってみよう。",
    ],
    next: "手足の先にも、似た色の毛があるかな？",
    rects: [[238, 190, 125, 95]],
    answerPath:
      "M252 229Q252 189 300 191Q350 191 349 230Q346 268 300 273Q254 267 252 229Z",
    explanation: {
      name: "顔を囲む明るい毛",
      form: "シロテテナガザルは、顔のまわりに明るい色の毛が見られます。",
      ecology:
        "長い腕で枝から枝へ移動します。顔だけでなく、手足の色も観察しよう。",
    },
    source: zoo + "h_lar",
  },
  {
    id: "bear",
    groupId: "bear",
    page: 13,
    part: "胸の白い模様",
    question: "胸の明るい模様は、どんな形？",
    hints: [
      "顔ではなく、首の下の胸を見てみよう。",
      "明るい毛の左右の端と、真ん中の高さを見くらべよう。",
    ],
    next: "体の向きが変わると、模様はどう見える？",
    rects: [[175, 290, 250, 110]],
    answerPath: "M190 308Q300 361 410 308L386 350Q300 407 214 350Z",
    explanation: {
      name: "胸の月の輪模様",
      form: "ツキノワグマの胸には、白っぽい毛の模様が見られます。形や大きさには個体差があります。",
      ecology: "木の実や果実、昆虫など、いろいろなものを食べます。",
    },
    source: zoo + "u_thibetanus",
  },
  {
    id: "hippo-tail",
    groupId: "hippo",
    page: 15,
    part: "短い尻尾",
    base: "hippo",
    question: "尻尾の付け根から先まで、どんな形？",
    hints: [
      "お尻の後ろにある、小さな尻尾を探そう。",
      "尾の先の広がりと、動く向きを見てみよう。",
    ],
    next: "お尻の近くで尻尾を動かすとき、何をしている？",
    rects: [[500, 330, 75, 95]],
    answerPath:
      "M510 348Q550 349 548 386L561 410L544 402L534 414L535 388Q540 367 510 364Z",
    explanation: {
      name: "短い尻尾",
      form: "大きな体に比べて、尻尾は短く、先には毛が見られます。",
      ecology:
        "水中や水辺で休むことが多い動物です。見えたときに尾の動きも確かめよう。",
    },
    source: zoo + "h_amphibius",
  },
  {
    id: "meerkat-claws",
    groupId: "meerkat",
    page: 15,
    part: "前足の爪",
    base: "meerkat",
    question: "前足の先の爪は、どちらへ伸びる？",
    hints: [
      "立ったときに胸の前にある、前足を探そう。",
      "毛の先から出ている爪の長さと曲がり方を見よう。",
    ],
    next: "穴を掘るとき、前足はどのように動く？",
    rects: [
      [210, 385, 50, 65],
      [344, 385, 50, 65],
    ],
    answerPath:
      "M221 399L216 425M233 401L230 433M245 399L246 426M354 399L350 426M366 401L370 433M378 399L384 425",
    explanation: {
      name: "前足の長い爪",
      form: "前足の先には、細く伸びた爪があります。",
      ecology:
        "ミーアキャットは地面に穴を掘り、家族で暮らします。掘るときの足の使い方を見てみよう。",
    },
    source: zoo + "s_suricatta-2",
  },
  {
    id: "tapir",
    groupId: "tapir",
    page: 17,
    part: "背中のたてがみ",
    question: "頭の後ろから背中へ、毛はどのように続く？",
    hints: [
      "長い鼻の後ろ、首の上を見てみよう。",
      "まわりより立っている毛のふちをたどろう。",
    ],
    next: "鼻を使って、食べ物をどう取っている？",
    rects: [[200, 235, 220, 95]],
    answerPath:
      "M207 271L214 243L226 261L235 252L248 282L264 267L277 291L292 280L307 296L322 284L338 299L352 290L370 301L385 295L408 307L400 319Q290 286 210 316Z",
    explanation: {
      name: "首から背中のたてがみ",
      form: "アメリカバクは、頭の後ろから背中にかけて短いたてがみが見られます。",
      ecology: "南米の森林や水辺に暮らし、木の葉や芽、果実などを食べます。",
    },
    source: zoo + "t_terrestris_2",
  },
  {
    id: "hyrax",
    groupId: "hyrax",
    page: 17,
    part: "お尻の輪郭",
    question: "背中からお尻へ、尻尾はどのように見える？",
    hints: [
      "顔の反対側、体のいちばん後ろを見てみよう。",
      "長い尻尾があるか、丸い輪郭か、見えたままにたどろう。",
    ],
    next: "日なたと日かげで、どのように過ごしている？",
    rects: [[365, 300, 155, 190]],
    answerPath: "M385 316Q488 314 498 386Q511 444 465 477",
    explanation: {
      name: "丸いお尻の輪郭",
      form: "ケープハイラックスは、長い尻尾が目立たない、丸みのある姿です。",
      ecology:
        "岩のすき間などを利用して群れで暮らし、日なたや日かげで体の温度を調節します。",
    },
    source: zoo + "p_capensis",
  },
  {
    id: "giraffe-horns",
    groupId: "giraffe",
    page: 18,
    part: "頭の角",
    base: "giraffe",
    question: "頭の上の角は、どこからどんなふうに伸びる？",
    hints: [
      "耳と角を分けて見てみよう。",
      "角の先まで、毛の生え方と輪郭をたどろう。",
    ],
    next: "別のキリンと、角の先の毛を見くらべよう。",
    rects: [[150, 48, 125, 70]],
    answerPath:
      "M174 112L161 77Q158 61 170 61Q184 61 180 77L187 111M241 108L246 66Q245 53 256 53Q267 54 263 69L258 112",
    explanation: {
      name: "毛におおわれた角",
      form: "キリンの頭には、皮膚と毛におおわれた角があります。先の毛や見え方には個体差があります。",
      ecology: "角だけでなく、長い耳やまつ毛も見くらべてみよう。",
    },
    source: zoo + "g_camelopardalis",
  },
  {
    id: "hippo-skin",
    groupId: "hippo",
    page: 18,
    part: "皮膚の色",
    base: "hippo",
    question: "背中の皮膚は、どんな色やつやに見える？",
    hints: [
      "水から出たとき、背中やわき腹を見てみよう。",
      "乾いたところとぬれたところで、見え方は違うかな？",
    ],
    next: "水に入る前と後で、皮膚の見え方を見くらべよう。",
    rects: [[270, 310, 200, 105]],
    answerPath:
      "M299 350Q292 333 303 322Q318 340 311 352ZM363 377Q355 359 366 347Q381 367 375 379ZM423 348Q415 331 427 318Q442 340 433 351Z",
    explanation: {
      name: "皮膚を守る分泌液",
      form: "カバの皮膚には、赤みのある分泌液が出ることがあります。いつも赤い点が見えるわけではありません。",
      ecology:
        "分泌液は皮膚を乾燥などから守るのに役立ちます。お手本の点は液の位置を示す模式図です。",
    },
    source: zoo + "h_amphibius",
  },
  {
    id: "bush-dog",
    groupId: "bush-dog",
    page: 19,
    part: "足の水かき",
    question: "足の指と指の間は、どのようにつながっている？",
    hints: [
      "地面にふれる前足の先を、見える向きから見よう。",
      "指の境目と、その間のつながりを見くらべよう。",
    ],
    next: "水に入ったとき、足をどう動かす？",
    rects: [[150, 440, 135, 105]],
    answerPath:
      "M166 522Q157 491 176 469Q187 457 197 478Q209 457 220 478Q236 460 245 477Q263 495 254 523L235 514L217 524L197 513L179 524Z",
    explanation: {
      name: "指の間の水かき",
      form: "ヤブイヌの指の間には、水かきがあります。足先が見えるときに確かめてみよう。",
      ecology: "森林や沼地に暮らし、泳いだり水に潜ったりすることも得意です。",
    },
    source: zoo + "s_venaticus",
  },
  {
    id: "macaque-face",
    groupId: "macaque",
    page: 20,
    part: "顔のふちの毛",
    question: "顔の外側の毛は、どんな向きに伸びている？",
    hints: [
      "目や鼻ではなく、ほっぺの外側を見てみよう。",
      "顔の皮膚と毛の境目を、あごまでたどろう。",
    ],
    next: "子どもと大人で、顔のまわりの毛は違うかな？",
    rects: [
      [166, 110, 72, 160],
      [362, 110, 72, 160],
    ],
    answerPath:
      "M225 122L194 134L207 146L179 162L195 181L175 207L198 222L190 247L224 255M375 122L406 134L393 146L421 162L405 181L425 207L402 222L410 247L376 255",
    explanation: {
      name: "顔を囲む毛",
      form: "アカゲザルの顔には、皮膚が見える部分と、その外側の毛があります。",
      ecology:
        "木の上と地面の両方で暮らします。顔を向けたとき、毛の向きも観察しよう。",
    },
    source: zoo + "m_mulatta",
  },
  {
    id: "gorilla-back",
    groupId: "gorilla",
    page: 20,
    part: "背中の毛",
    question: "背中の毛の色は、どこで変わっている？",
    hints: [
      "背中を向けたとき、肩から腰の間を見てみよう。",
      "まわりより明るい毛があるか、色の境目を探そう。",
    ],
    next: "群れのほかのゴリラの背中とも見くらべよう。",
    rects: [[160, 245, 280, 200]],
    answerPath: "M183 280Q300 250 417 280L405 402Q300 433 195 402Z",
    explanation: {
      name: "シルバーバック",
      form: "大人のオスは背中の毛が銀白色になり、シルバーバックと呼ばれます。メスや子どもとは見え方が違います。",
      ecology:
        "ニシゴリラは森林に暮らします。いま見ている個体の毛の色を大切にしよう。",
    },
    source: zoo + "g_gorilla",
  },
  {
    id: "lemur-tail",
    groupId: "lemur",
    page: 20,
    part: "尻尾の輪模様",
    base: "lemur",
    question: "長い尻尾には、どんな模様が続いている？",
    hints: [
      "体から離れて伸びる尻尾を、先まで探そう。",
      "明るい毛と暗い毛の間隔を見くらべよう。",
    ],
    next: "歩くとき、尻尾をどんな向きに立てる？",
    rects: [
      [438, 340, 100, 180],
      [365, 502, 125, 65],
    ],
    answerPath:
      "M476 365L516 383M489 408L527 423M481 455L519 474M456 493L491 521M407 522L430 554",
    explanation: {
      name: "尻尾の輪模様",
      form: "長い尻尾には、明るい毛と暗い毛が交互に並ぶ輪模様があります。",
      ecology: "木の上でも地面でも活動します。尾を立てて歩く姿も見てみよう。",
    },
    source: zoo + "l_catta",
  },
];

/** All 30 cards, in source reading order. Existing extra tasks remain available. */
export const sourceCards = [
  ["meerkat", 11],
  ["zebra-lashes", 11],
  ["giraffe", 11],
  ["mandrill", 12],
  ["gibbon-face", 12],
  ["lemur", 12],
  ["badger", 13],
  ["bear", 13],
  ["deer", 13],
  ["hippo", 14],
  ["zebra", 14],
  ["fennec-tail", 14],
  ["hippo-tail", 15],
  ["meerkat-claws", 15],
  ["giraffe-hoof", 15],
  ["gorilla", 16],
  ["capuchin", 16],
  ["macaque", 16],
  ["elephant", 17],
  ["tapir", 17],
  ["hyrax", 17],
  ["giraffe-horns", 18],
  ["hippo-skin", 18],
  ["fennec", 18],
  ["bush-dog", 19],
  ["donkey", 19],
  ["goat", 19],
  ["macaque-face", 20],
  ["gorilla-back", 20],
  ["lemur-tail", 20],
] as const;

// One card can describe a shared feature of multiple animals.
export const sharedCardTasks: Record<string, string[]> = {
  "zebra-lashes": ["giraffe-lashes"],
  goat: ["sheep"],
};
