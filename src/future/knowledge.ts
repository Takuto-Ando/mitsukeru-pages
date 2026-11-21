// 動物ごとの追加知識：食べ物・夜の様子・飼育員さんメモ。
// 一般に知られた生態の範囲で、観察の手がかりとして書いたもの。
export type AnimalKnowledge = {
  food: string;
  night: string;
  keeper: string;
};

export const KNOWLEDGE: Record<string, AnimalKnowledge> = {
  mandrill: {
    food: "果物・種・昆虫",
    night: "夜は木の上で集団で休みます",
    keeper: "オスの顔の色は順位が高いほど鮮やか。色の濃さに注目してね",
  },
  gibbon: {
    food: "果物・葉・花",
    night: "夜は木の上で腕を組んで休みます",
    keeper: "朝の歌声（デュエット）が名物。耳をすますと聞こえるかも",
  },
  lemur: {
    food: "果物・葉・花の蜜",
    night: "朝と夕方に活発。夜は集まって休みます",
    keeper: "しっぽの白黒の輪の数を数えてみて。個体で少し違うよ",
  },
  goat: {
    food: "草・野菜・干し草",
    night: "夜は反すうしながら休みます",
    keeper: "瞳孔は横長の四角。光で形が変わる様子を見てみて",
  },
  elephant: {
    food: "草・木の葉・果物",
    night: "夜は立ったまま短く眠ります",
    keeper: "鼻は水を吸ったり物をつかんだり。先端の動きが器用だよ",
  },
  capuchin: {
    food: "果物・昆虫・木の実",
    night: "夜は木の上で群れで休みます",
    keeper: "しっぽは第3の手。物に巻きつけてバランスを取るよ",
  },
  macaque: {
    food: "果物・葉・種",
    night: "夜は集団で寄り添って休みます",
    keeper: "お尻の赤さは健康のバロメーター。色を比べてみて",
  },
  badger: {
    food: "ミミズ・昆虫・果物",
    night: "夜行性。巣穴から出て活動します",
    keeper: "昼は寝ていることが多いよ。顔の白黒模様が目印",
  },
  zebra: {
    food: "草",
    night: "夜は交代で見張りをしながら休みます",
    keeper: "しま模様は1頭ごとに違う。たてがみの模様まで続いているよ",
  },
  giraffe: {
    food: "アカシアの葉",
    night: "夜は短時間だけ眠ることが多いです",
    keeper: "舌は約50cmと長くて紫色。葉を巻き取るように食べるよ",
  },
  hippo: {
    food: "草",
    night: "夕方から陸に上がって草を食べます",
    keeper: "鼻の穴は水の中で閉じられる。耳も小さく動くよ",
  },
  fennec: {
    food: "小動物・昆虫・卵",
    night: "夜行性。涼しい夜に活発に動きます",
    keeper: "大きな耳は体の熱を逃がすため。耳の大きさを比べてみて",
  },
  gorilla: {
    food: "葉・茎・果物",
    night: "夜は地面に葉のベッドを作って眠ります",
    keeper: "頭の形はオトナのオスの証。指紋も人と同じく1頭ずつ違うよ",
  },
  donkey: {
    food: "草・干し草",
    night: "夜は短く眠っては起きる、を繰り返します",
    keeper: "耳がとても長く、遠くの音を聞き分けます。耳の動きに注目",
  },
  meerkat: {
    food: "昆虫・サソリ・卵",
    night: "夜は巣穴の中で集まって眠ります",
    keeper: "見張り役が交代で立ちます。目の周りの黒はサングラスの役目",
  },
  deer: {
    food: "草・木の芽・ドングリ",
    night: "夜も活動し、短く眠ります",
    keeper: "背中の白い斑点は子鹿の名残り。オスは角が毎年生え替わるよ",
  },
  bear: {
    food: "木の実・昆虫・果物",
    night: "夜も活動します（薄明薄暮性）",
    keeper: "胸の三日月模様が名前の由来。模様の形は個体で違うよ",
  },
  tapir: {
    food: "葉・果物・水草",
    night: "夜行性気味。夜に活発に食べます",
    keeper: "背中の白い部分は鞍（くら）のよう。鼻は短いゾウの鼻みたい",
  },
  hyrax: {
    food: "草・葉・果物",
    night: "夜は岩陰で集まって休みます",
    keeper: "見た目は小さいけれど、実はゾウに近い仲間。足の裏に注目",
  },
  "bush-dog": {
    food: "小動物・鳥",
    night: "昼も夜も活動し、水辺を好みます",
    keeper: "足に水かきがあって泳ぎが得意。群れで行動するよ",
  },
};

export function knowledgeFor(groupId: string): AnimalKnowledge | undefined {
  return KNOWLEDGE[groupId];
}
