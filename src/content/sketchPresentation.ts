import { kyotoDrafts } from "./kyotoCatalog";
import type { Point } from "../types";
import type { Artwork } from "./artwork";
import type { CelebrationKind } from "./celebrations";
import type { SceneViewport } from "../drawing/viewport";
import type { Scene } from "./scenes";

export type PenColors = readonly [primary: string, secondary: string];

type SketchPresentation = {
  viewport?: SceneViewport;
  motion?: { kind: CelebrationKind | "tongue"; origin?: Point };
  prompt?: { text: string; lettering?: string };
};

type SketchDesign = SketchPresentation & {
  artwork: Artwork;
  geometry?: Partial<
    Pick<
      Scene,
      "frameHeight" | "regions" | "maskHoles" | "answerAsset" | "answerPath"
    >
  >;
};

const giraffeBase = "illustrations/pdf-design/giraffe";
const designs: Record<string, SketchDesign> = {
  giraffe: {
    artwork: {
      status: "draft",
      alt: "キリンの舌",
      incomplete: giraffeBase + ".svg",
      completedBase: giraffeBase + ".svg",
      reference: giraffeBase + "-complete.svg",
      answer: giraffeBase + "-complete.svg",
      explanation: giraffeBase + "-complete.svg",
      blankFill: "transparent",
      maskInApp: true,
      credit: "提供されたデザインPDFの28・30ページのイラスト",
    },
    geometry: { answerAsset: giraffeBase + "-complete.svg" },
    // Position from the 402px design export in the existing 600px scene.
    viewport: {
      x: 326 + (13.09 - 180) * 1.36,
      y: 305 + (162.55 - 403) * 1.26,
      width: 375.96 * 1.36,
      height: 425.48 * 1.26,
      aspectRatio: "375.96 / 425.48",
    },
    motion: { kind: "tongue", origin: { x: 326, y: 305 } },
    prompt: {
      text: "舌をよく観察してみて！",
      lettering: "illustrations/pdf-design/drawing-prompt-giraffe.svg",
    },
  },
};

const neutral: PenColors = ["#494144", "#8d7766"];
const colors: Record<string, PenColors> = {
  giraffe: ["#6b5c7a", "#977baf"],
  goat: ["#39313b", "#886749"],
  sheep: ["#40313a", "#8a735a"],
  mandrill: ["#a94443", "#496e96"],
  gibbon: ["#504239", "#aa7f56"],
  lemur: ["#363840", "#78666c"],
  elephant: ["#5b646c", "#89818d"],
  capuchin: ["#544231", "#826447"],
  macaque: ["#a65c57", "#744f48"],
  badger: ["#423d36", "#7f6c56"],
  zebra: ["#34343c", "#63656b"],
  hippo: ["#73555d", "#a87a7e"],
  fennec: ["#945a36", "#c68b51"],
  gorilla: ["#433c41", "#69606b"],
  donkey: ["#635044", "#917660"],
  meerkat: ["#654731", "#a17b53"],
  deer: ["#89583b", "#c0976e"],
  bear: ["#383032", "#a78d67"],
  "bush-dog": ["#765044", "#a96e4d"],
  horse: ["#80543d", "#b18560"],
  hyrax: ["#735b48", "#a98764"],
  tapir: ["#554d51", "#86777c"],
};

const draftColors = new Map(
  kyotoDrafts.map(({ groupId, draft }) => [groupId, draft.color]),
);

export function penColorsFor(groupId: string): PenColors {
  const draft = draftColors.get(groupId);
  return colors[groupId] ?? (draft ? [draft, neutral[0]] : neutral);
}

export function applySketchDesign(taskId: string, scene: Scene): Scene {
  const design = designs[taskId];
  if (!design) return scene;
  return { ...scene, ...design.geometry, artworkOverride: design.artwork };
}

export function sketchPresentationFor(
  scene: Scene,
): SketchPresentation | undefined {
  const design = designs[scene.id];
  return design &&
    scene.artworkOverride?.incomplete === design.artwork.incomplete
    ? design
    : undefined;
}
