import { useRef, useState } from "react";
import type { ObservationRecord } from "../notebook/types";
import {
  backupLimits,
  createNotebookBackup,
  parseNotebookBackup,
} from "../notebook/backup";
import { restoreObservations } from "../notebook/storage";
import { saveFile } from "../notebook/images";

export function NotebookTools({
  drawings,
  onRestored,
}: {
  drawings: ObservationRecord[];
  onRestored?: () => Promise<void> | void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ObservationRecord[]>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [space, setSpace] = useState("");
  async function capacity() {
    try {
      if (!navigator.storage?.estimate) {
        setSpace("このブラウザでは容量の情報を確認できません。");
        return;
      }
      const estimate = await navigator.storage.estimate();
      if (
        !Number.isFinite(estimate.usage) ||
        !Number.isFinite(estimate.quota)
      ) {
        setSpace("容量の情報を取得できませんでした。");
        return;
      }
      const mb = (bytes: number) =>
        (bytes / 1024 / 1024).toLocaleString("ja-JP", {
          maximumFractionDigits: 1,
        });
      setSpace(
        `このサイト全体の使用量：約${mb(estimate.usage!)}MB ／ 保存上限の目安：約${mb(estimate.quota!)}MB`,
      );
    } catch {
      setSpace(
        "容量の情報を取得できませんでした。ノートは引き続き利用できます。",
      );
    }
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "操作を完了できませんでした。もう一度試してください。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function choose(file: File) {
    setPending(undefined);
    if (file.size > backupLimits.bytes)
      throw new Error(
        "バックアップが大きすぎます。50MB以下のファイルを選んでください。",
      );
    const records = parseNotebookBackup(await file.text());
    setPending(records);
  }
  const existing = new Set(drawings.map((d) => d.id));
  const additions = pending?.filter((d) => !existing.has(d.id)).length || 0;
  return (
    <details
      className="notebook-tools"
      onToggle={(e) => {
        if (e.currentTarget.open) void capacity();
      }}
    >
      <summary>ノートのバックアップ・保存容量</summary>
      <p>絵と解説をまとめてファイルに残せます。写真と研究記録は含みません。</p>
      <button
        className="text-button"
        disabled={busy || !drawings.length}
        onClick={() =>
          void run(async () => {
            const backup = await createNotebookBackup(drawings);
            const started = await saveFile(
              backup,
              `zooketch-notes-${new Date().toISOString().slice(0, 10)}.json`,
            );
            setMessage(
              started
                ? "バックアップの保存操作を開始しました。保存したファイルを確認してください。"
                : "保存を取りやめました。",
            );
          })
        }
      >
        ノートをバックアップ
      </button>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        バックアップから復元
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        aria-label="観察ノートのバックアップファイル"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void run(() => choose(file));
        }}
      />
      {pending && (
        <div className="backup-preview">
          <p>
            {pending.length}件を確認しました。追加予定 {additions}
            件・既存と同じ記録 {pending.length - additions}件。
          </p>
          <p>今ある記録は削除・上書きしません。</p>
          <button
            disabled={busy || !pending.length}
            onClick={() =>
              void run(async () => {
                let result;
                try {
                  result = await restoreObservations(pending);
                } catch {
                  throw new Error(
                    "ノートを復元できませんでした。空き容量を確認してもう一度試してください。今ある記録は残しています。",
                  );
                }
                setPending(undefined);
                try {
                  await onRestored?.();
                } catch {
                  setMessage(
                    `${result.added}件は復元済みです。一覧を読み込めなかったため、画面を開き直してください。`,
                  );
                  return;
                }
                setMessage(
                  `${result.added}件を復元しました。既存の${result.skipped}件はそのまま残しました。`,
                );
                void capacity();
              })
            }
          >
            確認して追加する
          </button>
          <button disabled={busy} onClick={() => setPending(undefined)}>
            やめる
          </button>
        </div>
      )}
      {busy && <p role="status">ノートを処理しています…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p className="quiet-note">
        バックアップには自分の絵が含まれます。保存先は自分で選び、共有する場合は内容を確認してください。
      </p>
      {space && <p role="status">{space}</p>}
      <button className="text-button" onClick={() => void capacity()}>
        保存容量を確認
      </button>
      <p className="quiet-note">
        容量はAIモデルなども含む目安です。ブラウザのデータ削除ではノートも消えるため、残したい絵はバックアップしてください。
      </p>
    </details>
  );
}
