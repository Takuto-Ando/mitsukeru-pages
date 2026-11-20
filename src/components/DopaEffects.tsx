import type { CSSProperties } from "react";
import { Check, Sparkles } from "lucide-react";
import { assetPath } from "../content/artwork";

const steps = ["撮影", "描画", "答え合わせ", "解説"];

export function DopaProgress({ step }: { step: number }) {
  return (
    <ol className="dopa-progress" aria-label="観察のステップ">
      {steps.map((label, index) => (
        <li
          key={label}
          aria-current={index === step ? "step" : undefined}
          data-done={index < step || undefined}
        >
          <span className="dopa-progress-marker" aria-hidden="true">
            {index < step ? <Check size={13} strokeWidth={3} /> : index + 1}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function DopaTitleArt() {
  return (
    <div className="dopa-title-art" aria-hidden="true">
      <Sparkles className="dopa-title-spark dopa-title-spark-left" size={38} />
      <img
        alt=""
        width={353}
        height={250}
        src={assetPath("illustrations/pdf-design/pitsune-cheer.svg")}
      />
      <Sparkles className="dopa-title-spark dopa-title-spark-right" size={48} />
    </div>
  );
}

const confetti = [
  [-139, -35, -62],
  [-111, -61, 120],
  [-84, -49, -135],
  [-52, -68, 55],
  [-22, -47, 95],
  [16, -65, -80],
  [52, -46, 142],
  [88, -66, -48],
  [119, -48, 131],
  [147, -22, -101],
  [-130, 24, 103],
  [-81, 42, -113],
  [81, 39, 130],
  [131, 26, -77],
] as const;

export function DopaResultBanner({
  title,
  passed,
}: {
  title: string;
  passed: boolean;
}) {
  return (
    <div className="dopa-result-banner" data-discovered={passed}>
      {passed && (
        <div
          className="dopa-confetti"
          aria-hidden="true"
          data-testid="dopa-confetti"
        >
          {confetti.map(([x, y, turn]) => (
            <i
              key={x}
              style={
                {
                  "--burst-x": x + "px",
                  "--burst-y": y + "px",
                  "--burst-turn": turn + "deg",
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="dopa-result-mascot">
        <img
          alt=""
          src={assetPath(
            passed
              ? "illustrations/pdf-design/pitsune-cheer.svg"
              : "figma/entry/sketch-face.svg",
          )}
        />
      </div>
      <div className="dopa-result-message">
        <h1>{title}</h1>
        <p>
          {passed
            ? "描いた形をお手本と比べよう。"
            : "実物とお手本を見て、気づいたところを確かめよう。"}
        </p>
      </div>
    </div>
  );
}
