export interface Artwork {
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
export function assetPath(path: string) {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
