export interface ObservationGroup {
  id: string;
  name: string;
  part: string;
  question: string;
  fact: string;
  source?: string;
  evaluation: "horizontal" | "self";
  explanationStatus: "verified" | "partial" | "unverified";
  answer: { kind: "pupil" | "pending"; asset?: string };
  media?: { path: string; alt: string; credit?: string };
}
// Add supplied photos here; paths are relative to public/, without a leading slash.
export const groupPhotos: Record<
  string,
  NonNullable<ObservationGroup["media"]>
> = {};
const rows = [
  [
    "mandrill",
    "マンドリル",
    "顔",
    "鼻の両側の色や溝は、どんな並び？",
    "成長した個体では鼻の両側に盛り上がった溝が見られます。顔の色は年齢や性別でも異なります。",
    "m_sphinx",
    "partial",
  ],
  [
    "gibbon",
    "シロテテナガザル",
    "腕",
    "腕の長さと、枝をつかむときの形を描こう。",
    "長い腕で枝から枝へ移動します。地上では両腕でバランスをとります。",
    "h_lar",
    "verified",
  ],
  [
    "lemur",
    "ワオキツネザル",
    "目",
    "目のまわりにどんな形や色が見える？",
    "尾の輪模様が名前の由来です。目のまわりの模様の生態的な働きは、今回参照した公式図鑑では確認できていません。",
    "l_catta",
    "partial",
  ],
  [
    "goat",
    "ヤギ・ヒツジ",
    "目",
    "目の黒い部分はどんな形？",
    "ヤギの横長の瞳孔の先行体験です。ヒツジについては個別のお手本と解説を確認中です。",
    "c_aegagrus",
    "partial",
  ],
  [
    "elephant",
    "アジアゾウ",
    "頭",
    "頭から鼻へ続く輪郭を描こう。",
    "長い鼻は上唇と鼻が伸びたもので、食べ物を取るときに器用に使います。",
    "e_maximus",
    "verified",
  ],
  [
    "capuchin",
    "フサオマキザル",
    "尻尾",
    "尾をどんなふうに曲げたり巻いたりする？",
    "尾でものをつかみ、自分の体重を支えることができます。",
    "c_apella",
    "verified",
  ],
  [
    "macaque",
    "アカゲザル",
    "尻",
    "お尻の輪郭や毛のあるところを観察しよう。",
    "樹上と地上の両方で生活し、母系の群れを作ります。尻の特徴の生態的な働きは今回の公式図鑑では未確認です。",
    "m_mulatta",
    "partial",
  ],
  [
    "badger",
    "ニホンアナグマ",
    "顔",
    "顔の模様の位置や形を描こう。",
    "前足の発達した爪で巣穴を掘ります。顔の模様の働きについては確認中です。",
    "m_meles",
    "partial",
  ],
  [
    "zebra",
    "シマウマ",
    "指・ひづめ",
    "足先に見えるひづめの輪郭を描こう。",
    "対象となる種と京都市動物園の現在の掲載を確認中です。ひづめの形や働きのお手本・解説は未確認です。",
    "",
    "unverified",
  ],
  [
    "giraffe",
    "キリン",
    "指・舌",
    "足先や、食べるときの舌の形を描こう。",
    "現生の動物の中で最も背が高い動物です。指定部位の個別のお手本と解説は確認中です。",
    "g_camelopardalis",
    "partial",
  ],
  [
    "hippo",
    "カバ",
    "顔・からだ",
    "水に入ったとき、顔やからだはどこまで見える？",
    "日中は水中や水辺で休みます。皮膚を乾燥から守るために、陸上で赤い液体を分泌します。",
    "h_amphibius",
    "verified",
  ],
  [
    "fennec",
    "フェネック",
    "足・尻尾",
    "足と尾の毛や輪郭を描こう。",
    "砂漠に巣穴を掘り、暑さや冷気を避けます。足と尾の特徴の働きは今回の公式図鑑では未確認です。",
    "v_zerda",
    "partial",
  ],
  [
    "gorilla",
    "ニシゴリラ",
    "頭",
    "頭の上から顔への輪郭はどんな形？",
    "熱帯雨林に暮らし、多様な植物や昆虫を食べます。頭の形の個体差や働きは確認中です。",
    "g_gorilla",
    "partial",
  ],
  [
    "donkey",
    "ロバ",
    "背中",
    "背中の線や模様を描こう。",
    "アフリカノロバを家畜化して成立したと考えられています。背中の模様の働きは今回の公式図鑑では未確認です。",
    "e_asinus",
    "partial",
  ],
  [
    "meerkat",
    "ミーアキャット",
    "顔",
    "目のまわりの模様を描こう。",
    "地中にトンネルを掘り、家族で暮らします。目のまわりの模様の働きは今回の公式図鑑では未確認です。",
    "s_suricatta-2",
    "partial",
  ],
  [
    "deer",
    "ニホンジカ",
    "背中",
    "背中の毛や模様を描こう。今はどんな季節？",
    "園の掲載名はホンシュウジカです。夏毛には白い斑点がありますが、冬毛では斑点が消えます。模様の生態的な働きは確認中です。",
    "c_nippon",
    "partial",
  ],
] as const;
export const groups: ObservationGroup[] = rows.map(
  ([id, name, part, question, fact, slug, explanationStatus]) => ({
    id,
    name,
    part,
    question,
    fact,
    source: slug
      ? `https://zoo.city.kyoto.lg.jp/zoo/animals/${slug}`
      : undefined,
    evaluation: id === "goat" ? "horizontal" : "self",
    explanationStatus,
    media: groupPhotos[id],
    answer: { kind: id === "goat" ? "pupil" : "pending" },
  }),
);
export const rosterNote =
  "16グループはMIKECA画像からの判読による暫定リストです。正式な全30カードとの一致は未確認です。掲載確認は現地で見られることの保証ではありません。";
