import { SketchLines } from "../Illustrations";
import { Pitsune } from "./Pitsune";
import type { ObservationRecord } from "../notebook/types";

// ピツネのお部屋：最近の観察カードが壁に飾られていくコレクションルーム。
export function PitsuneRoom({
  drawings,
}: {
  drawings: ObservationRecord[];
}) {
  const recent = [...drawings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  return (
    <section className="pitsune-room" aria-label="ピツネのお部屋">
      <h3 className="extras-heading">ピツネのお部屋</h3>
      {recent.length === 0 ? (
        <p>観察カードを保存すると、ここに絵が飾られていくよ。</p>
      ) : (
        <div className="room-wall">
          {recent.map((d) => (
            <figure key={d.id} className="room-frame">
              <svg viewBox="0 0 600 400" role="img" aria-label={d.animalName}>
                <SketchLines strokes={d.strokes} />
              </svg>
              <figcaption>{d.animalName}</figcaption>
            </figure>
          ))}
          <div className="room-pitsune">
            <Pitsune pose="face" className="room-pitsune-face" />
            <p>ぼくの部屋が にぎやかになってきた！</p>
          </div>
        </div>
      )}
    </section>
  );
}
