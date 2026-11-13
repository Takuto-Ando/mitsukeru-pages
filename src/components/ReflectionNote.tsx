import { useId } from "react";
export function ReflectionNote({
  value,
  question,
  disabled,
  onChange,
}: {
  value: { discovery: string; revisited: boolean };
  question: string;
  disabled: boolean;
  onChange: (value: { discovery: string; revisited: boolean }) => void;
}) {
  const id = useId();
  return (
    <fieldset className="reflection-note" disabled={disabled}>
      <legend>もう一度、本物を見てみよう</legend>
      <p>{question}</p>
      <label className="reflection-check">
        <input
          type="checkbox"
          checked={value.revisited}
          onChange={(e) => onChange({ ...value, revisited: e.target.checked })}
        />
        実物を見て確かめた
      </label>
      <label htmlFor={id}>どんなことに気づいた？（書かなくても大丈夫）</label>
      <textarea
        id={id}
        rows={2}
        maxLength={200}
        value={value.discovery}
        onChange={(e) => onChange({ ...value, discovery: e.target.value })}
      />
    </fieldset>
  );
}
