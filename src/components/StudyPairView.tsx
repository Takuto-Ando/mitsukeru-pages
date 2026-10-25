import { useEffect, useState } from "react";
import type { Scene } from "../content/scenes";
import type { Evaluation, Stroke } from "../types";
import {
  captureStudyDrawing,
  saveStudyPair,
  type StudyDrawing,
} from "../research/pairs";
export function StudyPairView({
  id,
  scene,
  before,
  strokes,
  evaluation,
}: {
  id: string;
  scene: Scene;
  before: StudyDrawing;
  strokes: Stroke[];
  evaluation: Evaluation;
}) {
  const [after, setAfter] = useState<StudyDrawing>();
  const [message, setMessage] = useState("2回の描画を記録しています…");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    void captureStudyDrawing(scene, strokes, evaluation)
      .then(async (result) => {
        if (!alive) return;
        await saveStudyPair({ id, taskId: scene.id, before, after: result });
        if (alive) {
          setAfter(result);
          setMessage("2回の描画をこの端末に記録しました。");
        }
      })
      .catch(() => {
        if (alive)
          setMessage(
            "2回の記録を保存できませんでした。空き容量と研究モードの状態を確認してください。",
          );
      });
    return () => {
      alive = false;
    };
  }, [id, scene, before, strokes, evaluation, retry]);
  return (
    <section className="study-pair" aria-label="2回の描画の比較">
      <h2>2回の絵を見くらべよう</h2>
      <p>同じところ、変わったところはどこかな？</p>
      <div className="study-pair-images">
        <figure>
          <img src={before.image} alt="1回目の描画" />
          <figcaption>1回目</figcaption>
        </figure>
        {after && (
          <figure>
            <img src={after.image} alt="2回目の描画" />
            <figcaption>2回目</figcaption>
          </figure>
        )}
      </div>
      <p role="status">{message}</p>
      {!after && message.includes("できません") && (
        <button onClick={() => setRetry((v) => v + 1)}>
          記録をもう一度試す
        </button>
      )}
    </section>
  );
}
