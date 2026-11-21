import type { TrackedLiveBox } from "../recognition/liveBoxes";

export function LiveAnimalOverlay({
  boxes,
}: {
  boxes: readonly TrackedLiveBox[];
}) {
  if (!boxes.length) return null;
  return (
    <div className="live-animal-overlay" aria-label="ライブ検出の候補">
      {boxes.map(({ id, label, left, top, right, bottom }) => (
        <div
          key={id}
          className="live-animal-box"
          data-align-end={left > 0.62}
          style={{
            left: left * 100 + "%",
            top: top * 100 + "%",
            width: (right - left) * 100 + "%",
            height: (bottom - top) * 100 + "%",
          }}
        >
          <span>{label}の候補</span>
        </div>
      ))}
    </div>
  );
}
