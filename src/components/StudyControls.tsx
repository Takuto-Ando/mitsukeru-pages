import { useEffect, useState, useSyncExternalStore } from "react";
import {
  initializeStudy,
  studyStatus,
  subscribeStudy,
  startStudy,
  stopStudy,
  withdrawStudy,
  exportStudy,
} from "../research/study";

export function StudyControls() {
  const status = useSyncExternalStore(subscribeStudy, studyStatus),
    [consent, setConsent] = useState(false),
    [comparisonStudy, setComparisonStudy] = useState(false),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    void initializeStudy();
  }, []);
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch {
      setMessage(
        "研究記録の操作を完了できませんでした。保存容量やブラウザの設定を確認してください。",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="study-controls">
      <summary>
        {status.collecting ? "研究記録中・参加設定" : "研究への参加・記録"}
      </summary>
      <p>研究への参加は任意です。同意しなくてもすべての観察を楽しめます。</p>
      <p>
        課題の操作時刻、描画の開始・終了、ヒント、判定、比較スライダー、解説の閲覧をこのブラウザに記録します。写真・描画画像・氏名・連絡先・位置情報は研究ログに含めず、外部へ自動送信しません。
      </p>
      <p>
        記録はいつでも停止でき、同意を撤回すると研究ログをすべて削除します。観察ノートは残ります。書き出したファイルは別途削除が必要です。
      </p>
      {!status.collecting && (
        <>
          <label className="participant-field">
            匿名の参加者コード（任意・英数字のみ）
            <input
              type="text"
              inputMode="text"
              autoCapitalize="off"
              autoCorrect="off"
              maxLength={24}
              placeholder="空欄なら自動生成（例: P-01）"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))
              }
            />
          </label>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={comparisonStudy}
              onChange={(e) => setComparisonStudy(e.target.checked)}
            />
            同じ課題を2回描く研究モードを使う
          </label>
          <p className="quiet-note">
            2回描く研究モードでは、1回目・2回目の描画画像もこの端末に保存します。JSONへの書き出しには画像と各回の操作記録を含みます。撮影写真は保存しません。氏名などを参加者コードに入力しないでください。
          </p>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            説明を読み、研究用の操作記録に同意します
          </label>
          <button
            className="primary"
            disabled={!consent || !status.ready || busy}
            onClick={() =>
              void run(
                () => startStudy(consent, code, comparisonStudy),
                "記録を開始しました。同意前の操作は記録されません。撮影から始めてください。",
              )
            }
          >
            同意して記録を始める
          </button>
        </>
      )}
      {status.collecting && (
        <>
          {status.participantCode && (
            <p className="quiet-note">
              参加者コード: <strong>{status.participantCode}</strong>
            </p>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void run(stopStudy, "研究記録を停止しました。")}
          >
            研究記録を終了する
          </button>
        </>
      )}
      {status.consented && (
        <>
          <div className="study-export">
            <button
              disabled={busy}
              onClick={() =>
                void run(() => exportStudy("json"), "JSONを書き出しました。")
              }
            >
              研究ログをJSONで保存
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(() => exportStudy("csv"), "CSVを書き出しました。")
              }
            >
              研究ログをCSVで保存
            </button>
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await withdrawStudy();
                setConsent(false);
                setComparisonStudy(false);
                setCode("");
              }, "同意を撤回し、ブラウザ内の研究ログを削除しました。")
            }
          >
            同意を撤回して研究ログを削除
          </button>
        </>
      )}
      {(message || status.error) && (
        <p role="status">{status.error || message}</p>
      )}
    </details>
  );
}
