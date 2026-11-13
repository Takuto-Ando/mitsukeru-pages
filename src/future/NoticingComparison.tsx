import { useId } from "react";
import type { ObservationComparison } from "./observationComparison";
/** Display-only panel. The caller controls consent, persistence and navigation. */
export function NoticingComparison({
  value,
}: {
  value: ObservationComparison;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>見つけたことを振り返ろう</h2>
      <dl>
        <dt>描く前に気づいたこと</dt>
        <dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {value.before.noticing || "書いていません"}
        </dd>
        <dt>描いた後に気づいたこと</dt>
        <dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {value.after.noticing || "書いていません"}
        </dd>
      </dl>
      {value.revisitedSelfReport && (
        <p>実物をもう一度見て確かめた（自分の記録）</p>
      )}
    </section>
  );
}
