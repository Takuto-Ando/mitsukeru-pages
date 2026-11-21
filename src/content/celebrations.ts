// 合格・提出後の「描いた特徴が動く」お祝いアニメーションの割り当て。
// キリンの舌だけは専用シーン（TongueCelebration）があり、ここには含めない。
export type CelebrationKind =
  | "sway" // 付け根を中心にゆらゆら（腕・鼻・尾など）
  | "curl" // くるっと巻く（巻き尾）
  | "blink" // 縦につぶれる（目・まつ毛）
  | "slide" // 左右にキョロキョロ（瞳孔）
  | "wiggle" // 小刻みにふるえる（耳・角・お尻）
  | "bounce" // 跳ねる・叩く（ひづめ・爪）
  | "bob" // 上下に浮き沈み（水面の鼻）
  | "pulse"; // ふくらむ（模様・ふくらみ）

export type Celebration = { kind: CelebrationKind; caption: string };

const table: Record<string, Celebration> = {
  mandrill: { kind: "pulse", caption: "描いた顔の模様が、ゆらゆら！" },
  gibbon: { kind: "sway", caption: "描いた腕が、ブランコみたいに ゆらゆら！" },
  lemur: { kind: "blink", caption: "描いた目の模様が、パチパチ！" },
  goat: { kind: "slide", caption: "描いた瞳孔が、キョロキョロ！" },
  sheep: { kind: "slide", caption: "描いた瞳孔が、キョロキョロ！" },
  elephant: { kind: "bounce", caption: "描いた頭のふくらみが、ポヨン！" },
  capuchin: { kind: "curl", caption: "描いた尾が、くるりん！" },
  macaque: { kind: "wiggle", caption: "描いたお尻が、フリフリ！" },
  badger: { kind: "pulse", caption: "描いた顔の模様が、ゆらゆら！" },
  zebra: { kind: "bounce", caption: "描いたひづめが、トントン！" },
  hippo: { kind: "bob", caption: "描いた鼻が、水面で ぷかぷか！" },
  fennec: { kind: "wiggle", caption: "描いたところが、ピクピク！" },
  deer: { kind: "pulse", caption: "描いた斑点が、キラキラ！" },
  donkey: { kind: "wiggle", caption: "描いた耳が、ピクピク！" },
  meerkat: { kind: "pulse", caption: "描いた目のまわりが、ゆらゆら！" },
  gorilla: { kind: "sway", caption: "描いた背中が、ゆっさゆっさ！" },
  horse: { kind: "bounce", caption: "描いた足先が、トントン！" },
  // 追加の部位課題
  "giraffe-lashes": { kind: "blink", caption: "描いたまつ毛が、パチパチ！" },
  "zebra-lashes": { kind: "blink", caption: "描いたまつ毛が、パチパチ！" },
  "gibbon-face": { kind: "pulse", caption: "描いた顔の模様が、ゆらゆら！" },
  bear: { kind: "pulse", caption: "描いた胸の月が、ゆらゆら！" },
  "hippo-tail": { kind: "sway", caption: "描いた尾が、ゆらゆら！" },
  "meerkat-claws": { kind: "bounce", caption: "描いた爪が、ホリホリ！" },
  tapir: { kind: "sway", caption: "描いた鼻が、ゆらゆら！" },
  hyrax: { kind: "wiggle", caption: "描いたところが、ピクピク！" },
  "giraffe-horns": { kind: "wiggle", caption: "描いた角が、ピクピク！" },
  "hippo-skin": { kind: "pulse", caption: "描いた皮膚が、つやつや！" },
  "bush-dog": { kind: "pulse", caption: "描いたところが、ゆらゆら！" },
  "macaque-face": { kind: "pulse", caption: "描いた顔の模様が、ゆらゆら！" },
  "gorilla-back": { kind: "sway", caption: "描いた背中が、ゆっさゆっさ！" },
  "lemur-tail": { kind: "sway", caption: "描いた尾の模様が、ゆらゆら！" },
};

export const DEFAULT_CELEBRATION: Celebration = {
  kind: "pulse",
  caption: "描いたところが、うごいた！",
};

export function celebrationFor(taskId: string): Celebration {
  return table[taskId] ?? DEFAULT_CELEBRATION;
}
