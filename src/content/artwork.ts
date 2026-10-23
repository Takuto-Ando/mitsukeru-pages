export interface Artwork {
  blankFill?: string;
  maskInApp?: boolean;
  status: "awaiting" | "draft" | "reviewed";
  incomplete?: string; // 600 × 400, feature removed; never the unmasked answer
  completedBase?: string; // same frame, no target feature: user lines complete it
  answer?: string; // isolated feature, transparent background, same frame
  explanation?: string;
  alt: string;
  credit?: string;
  reviewedBy?: string;
}
// Accept supplied artwork here after anatomy and alignment review.
// No generated wireframe is silently promoted to reviewed educational artwork.
export const artwork: Record<string, Artwork> = Object.fromEntries(
  [
    ["mandrill", "マンドリルの顔の模様"],
    ["gibbon", "シロテテナガザルの腕"],
    ["lemur", "ワオキツネザルの目の周囲"],
    ["goat", "ヤギの目と瞳孔"],
    ["elephant", "アジアゾウの頭と鼻"],
    ["capuchin", "フサオマキザルの尾"],
    ["macaque", "アカゲザルのお尻"],
    ["badger", "ニホンアナグマの顔"],
    ["zebra", "シマウマのひづめ"],
    ["giraffe", "キリンの舌"],
    ["hippo", "カバの顔"],
    ["fennec", "フェネックの足"],
    ["gorilla", "ニシゴリラの頭"],
    ["donkey", "ロバの背中"],
    ["meerkat", "ミーアキャットの顔"],
    ["deer", "ニホンジカの背中"],
  ].map(([id, alt]) => [id, { status: "awaiting", alt }]),
);
// Generated natural-history prototypes. Visual review is recorded separately;
// not promoted to specialist-reviewed educational artwork.
for (const id of [
  ...Object.keys(artwork),
  "sheep",
  "giraffe-hoof",
  "hippo-body",
  "fennec-tail",
]) {
  const path = `illustrations/zooketch/${id}.jpg`;
  artwork[id] = {
    status: "draft",
    alt: artwork[id]?.alt || id,
    incomplete: path,
    completedBase: path,
    explanation: path,
    answer: ["goat", "sheep"].includes(id) ? undefined : path,
    maskInApp: true,
    blankFill: ["goat", "sheep"].includes(id) ? "transparent" : "#f8f4e9",
    credit: "本制作で生成した観察イラスト",
  };
}
// Put future photo / professionally reviewed replacements here by task ID.
// Paths stay relative to public/. The generated fallback registry above stays intact.
const suppliedArtwork: Record<string, Artwork> = {};
Object.assign(artwork, suppliedArtwork);
export function assetPath(path: string) {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
