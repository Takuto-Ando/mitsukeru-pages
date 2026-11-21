import { kyotoDrafts, zooSource } from "./kyotoCatalog";
import layouts from "./kyoto-layouts.json" with { type: "json" };
import type { Artwork } from "./artwork";
import type { ObservationTask } from "./tasks";

const layoutByShape = new Map(layouts.map((layout) => [layout.shape, layout]));
const observationPrompts: Record<string, [string, string]> = {
  耳: ["頭のどこから出ている？", "先はとがっている？ まるい？"],
  翼: [
    "からだから翼が伸びるところを探そう。",
    "翼を広げたとき、ふちにどんな曲がりがある？",
  ],
  尾: ["尾のつけ根を探そう。", "つけ根から先へ、どんな向きに伸びる？"],
  背中の針: ["背中を横から見てみよう。", "針の先はどちらを向いている？"],
  前足: [
    "枝からからだまで、前足を目でたどってみよう。",
    "指先は枝をどうつかんでいる？",
  ],
  くちばし: [
    "顔を横から見て、くちばしのつけ根を探そう。",
    "先の形をよく見よう。まっすぐかな、曲がっているかな？",
  ],
  曲がったくちばし: ["顔を横から見てみよう。", "どこで向きが変わっている？"],
  尾羽: [
    "背中から尾羽にかけて見てみよう。",
    "尾羽の先は、細い？ 広がっている？",
  ],
  顔のふち: ["左右の目を見つけよう。", "目を囲む色の境目はどこにつながる？"],
  首の輪郭: [
    "頭とからだの間を見てみよう。",
    "首の太さは、頭の近くとからだの近くで変わる？",
  ],
  胸の模様: [
    "白い羽と暗い羽の境目を探そう。",
    "胸の模様はどちらに向かって曲がる？",
  ],
  甲羅の模様: [
    "背中の甲羅を見てみよう。",
    "甲羅の線は背中の真ん中と端でどう違う？",
  ],
  からだの曲がり: [
    "頭から先の長いからだを目でたどろう。",
    "曲がりが大きいところを探してみよう。",
  ],
  口先: [
    "目から口先までの輪郭を横から見よう。",
    "口先へ近づくと、幅はどう変わる？",
  ],
  後ろ足の指: ["後ろ足の先を見つけよう。", "指はどちらに広がっている？"],
  巻いた尾: [
    "尾のつけ根から先まで見てみよう。",
    "曲がりが小さくなるのはどのあたり？",
  ],
  尾びれ: [
    "からだの後ろで左右に動くところを探そう。",
    "尾びれの外側と真ん中では、先の形がどう違う？",
  ],
};

export const kyotoDraftTasks: ObservationTask[] = kyotoDrafts.map((species) => {
  const layout = layoutByShape.get(species.draft!.shape)!;
  const { part, rect, answerPath } = layout;
  const [x, y, width, height] = rect;
  const [firstHint, next] = observationPrompts[part];
  const base = `illustrations/kyoto/${species.id}`;
  const reference = base + "-complete.svg";
  const illustration: Artwork = {
    status: "draft",
    alt: `${species.name}の観察用イラスト`,
    incomplete: base + ".svg",
    completedBase: base + ".svg",
    reference,
    answer: reference,
    explanation: reference,
    maskInApp: true,
    blankFill: "transparent",
  };
  return {
    id: species.id,
    groupId: species.groupId,
    part,
    question: `${species.name}の${part}を見て、足りないところを描こう。`,
    hint: firstHint,
    hints: [firstHint, next],
    next,
    method: "selfCheck",
    automatic: false,
    provisional: true,
    comparisonNote: "仮イラストです。実物で見えた形や模様も確かめよう。",
    scene: {
      id: species.id,
      label: part,
      frameHeight: 600,
      regions: [
        { x: x / 600, y: y / 600, width: width / 600, height: height / 600 },
      ],
      answerPath,
      answerAsset: reference,
      artworkOverride: illustration,
    },
    explanation: {
      name: part,
      form: `${species.name}の${part}を、描いた絵と実物で見くらべてみよう。`,
      ecology: "",
    },
    source: zooSource(species.slug),
    sourceNote:
      "公式図鑑の掲載種をもとにした仮課題。生態的な役割や仮図の種単位の検証は今後の作業。",
  };
});
