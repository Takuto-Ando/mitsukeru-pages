type AdoptedAnimal = {
  id: string;
  name: string;
  description: string;
  aliases?: readonly string[];
};

// These are the animals offered for a new observation. Existing records still
// resolve their original group and task IDs through the full catalog.
export const adoptedAnimals: readonly AdoptedAnimal[] = [
  {
    id: "meerkat",
    name: "ミーアキャット",
    description:
      "うしろ足で立って、まわりを見はるよ。\n地面に穴をほって、家族でくらしているよ。",
  },
  {
    id: "giraffe",
    name: "キリン",
    description:
      "動物の中でいちばん背が高いよ。\n長い首で、てきが近づいてくるのを見つけるよ。",
  },
  {
    id: "kyoto-h-cristata",
    name: "タテガミヤマアラシ",
    description:
      "せなかには、かたいトゲがたくさんあるよ。\nてきが近づくと、トゲを立てて身を守るよ。",
  },
  {
    id: "kyoto-g-eremita",
    name: "ホオアカトキ",
    description:
      "虫やカタツムリなどを食べる鳥だよ。\n高いがけに、仲間といっしょにすを作るよ。",
  },
  {
    id: "kyoto-n-meleagris",
    name: "ホロホロチョウ",
    description:
      "何百羽もの大きなむれでくらすことがあるよ。\nお父さんもお母さんも、ひなのお世話をするよ。",
  },
  {
    id: "kyoto-p-chilensis",
    name: "フラミンゴ",
    aliases: ["kyoto-p-ruber", "kyoto-p-roseus"],
    description:
      "湖などの水辺でくらす鳥だよ。\n曲がったくちばしで、水の中の小さな生き物を食べるよ。",
  },
  {
    id: "fennec",
    name: "フェネック",
    description:
      "大きな耳から体の熱をにがすよ。\nさばくに穴をほって、暑さや寒さをしのぐよ。",
  },
  {
    id: "hippo",
    name: "カバ",
    description:
      "昼は水の中や水辺でゆっくり休むよ。\n夜になると、陸に上がって草を食べるよ。",
  },
  {
    id: "elephant",
    name: "アジアゾウ",
    description:
      "長い鼻を上手に使って、草や木の葉を食べるよ。\n1日に40〜50キログラムもの食べものを食べるよ。",
  },
  {
    id: "tapir",
    name: "アメリカバク",
    description:
      "木の葉やくだもの、水草などを食べるよ。\n鼻を水の上に出して、上手に泳ぐことができるよ。",
  },
  {
    id: "hyrax",
    name: "ケープハイラックス",
    description:
      "岩のすきまや穴で、仲間とくらしているよ。\n日なたぼっこをして、体をあたためるよ。",
  },
  {
    id: "mandrill",
    name: "マンドリル",
    description:
      "大人になると、鼻が赤く、ほっぺたが青くなるよ。\nオスはおしりも赤や青、むらさき色になるよ。",
  },
  {
    id: "gibbon",
    name: "シロテテナガザル",
    description:
      "手や足の先の毛が白っぽいサルだよ。\n長いうでを使って、木のえだからえだへわたるよ。",
  },
  {
    id: "lemur",
    name: "ワオキツネザル",
    description:
      "キツネににた顔と、しましまのしっぽが特徴だよ。\n両うでを広げて、日なたぼっこをするよ。",
  },
  {
    id: "gorilla",
    name: "ニシゴリラ",
    description:
      "体は大きいけれど、おだやかな動物だよ。\n大人のオスは、せなかの毛が銀色になるよ。",
  },
  {
    id: "capuchin",
    name: "フサオマキザル",
    description:
      "長いしっぽで物をつかむことができるよ。\n手先がとても器用で、道具を使うこともあるよ。",
  },
  {
    id: "macaque",
    name: "アカゲザル",
    description:
      "ニホンザルににているけれど、しっぽが長いよ。\n木の上や地面で、くだものや虫を食べるよ。",
  },
  {
    id: "badger",
    name: "ニホンアナグマ",
    description:
      "前足の大きなつめで、地面に穴をほるよ。\n昼は穴の中で休み、夜になると活動するよ。",
  },
  {
    id: "bear",
    name: "ツキノワグマ",
    description:
      "木の実やくだもの、虫や魚などを食べるよ。\n冬は岩の穴や木の穴でねむってすごすよ。",
  },
  {
    id: "deer",
    name: "ニホンジカ",
    description:
      "夏には体に白いもようがあり、冬には消えるよ。\nオスの角は毎年春に落ち、新しい角が生えるよ。",
  },
  {
    id: "bush-dog",
    name: "ヤブイヌ",
    description:
      "足が短く、草や木のしげみを通るのが得意だよ。\n足の指の間に水かきがあり、泳ぐのも上手だよ。",
  },
  {
    id: "donkey",
    name: "ロバ",
    description:
      "およそ6000年前から人にかわれてきたといわれているよ。\nウマよりもじょうぶで、きびしい場所でもくらせるよ。",
  },
  {
    id: "goat",
    name: "ヤギ・ヒツジ",
    aliases: ["sheep"],
    description:
      "ヤギは山でくらすのに向いている動物だよ。\nヒツジは毛が自然に生えかわらないので、年に1回毛をかるよ。",
  },
  {
    id: "kyoto-g-senegalensis",
    name: "ショウガラゴ",
    description:
      "大きな目を持ち、夜に活動する小さなサルだよ。\n小さな体でも、2メートルほどジャンプできるよ。",
  },
  {
    id: "kyoto-c-didactylus",
    name: "ナマケモノ",
    description:
      "長いつめで木のえだにぶら下がってくらすよ。\n動きはゆっくりだけど、泳ぐのは得意だよ。",
  },
  {
    id: "kyoto-l-lynx",
    name: "オオヤマネコ",
    description:
      "冬になると、足のうらにも長い毛が生えるよ。\n足が雪にしずみにくくなり、雪の上を歩けるよ。",
  },
  {
    id: "kyoto-p-bengalensis",
    name: "ツシマヤマネコ",
    description:
      "長崎県のつしまにだけすんでいる野生のネコだよ。\nすむ場所がへるなどして、数が少なくなっているよ。",
  },
  {
    id: "kyoto-serval",
    name: "サーバル",
    description:
      "細くて長い足と、大きな耳が特徴のネコだよ。\n走るのが速く、ジャンプや木のぼりも得意だよ。",
  },
  {
    id: "kyoto-p-giganteus",
    name: "インドオオコウモリ",
    description:
      "つばさを広げると、最大で1.5メートルにもなるよ。\n昼は木にぶら下がり、夜はくだものをさがすよ。",
  },
  {
    id: "kyoto-a-fulgens",
    name: "レッサーパンダ",
    description:
      "竹の葉やタケノコをよく食べるよ。\n木のぼりが得意で、木の上でよく昼ねをするよ。",
  },
];

export const adoptedAnimalById = new Map(
  adoptedAnimals.flatMap((animal) =>
    [animal.id, ...(animal.aliases ?? [])].map((id) => [id, animal] as const),
  ),
);
