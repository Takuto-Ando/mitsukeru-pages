import type { Challenge } from "../types";
export const challenges: Challenge[] = [
  {
    animalId: "goat",
    animalName: "ヤギ",
    challengeId: "goat-pupil",
    title: "ヤギの瞳は、どんなかたち？",
    observationInstruction:
      "目のまんなかの、黒いところ。じっくり見たら、見えた形を描いてみよう。閉じなくても大丈夫。",
    drawingTemplate: "eye",
    evaluationType: "horizontal",
    observationParameters: {
      minAspect: 1.3,
      verticalAspect: 0.85,
      trim: 0.05,
      minHeight: 8,
      minWidth: 18,
    },
    hint: [
      "まぶたじゃなくて、まんなかの黒いところを見てみよう。",
      "たてとよこ、どちらが長いかな？ ふちをぐるっと、たどってみよう。",
    ],
    explanation: {
      name: "横長の瞳孔",
      fact: "ヤギの瞳は、横長！",
      role: "横長の瞳孔は、地面に沿って周りを広く見渡すのに役立つと考えられているよ。",
      ecology: "草を食べるときも、周りの様子に気づくことが大切なんだね。",
      question: "草を食べて頭を下げたとき、瞳の向きは変わるかな？",
      certainty:
        "横長の瞳孔は観察できる特徴です。見渡す働きは光学モデルに基づく研究上の説明です。",
    },
    difficulty: 1,
    scientificSource: [
      {
        title:
          "Banks et al. (2015), Why do animal eyes have pupils of different shapes?",
        url: "https://doi.org/10.1126/sciadv.1500391",
      },
    ],
    tags: ["瞳", "かたち", "観察"],
  },
];
