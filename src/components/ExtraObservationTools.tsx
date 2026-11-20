import { lazy, Suspense, useId, useState } from "react";
import { groups } from "../content/groups";
import { taskById, tasksForGroup } from "../content/tasks";
import { NoticingComparison } from "../future/NoticingComparison";
import {
  compareObservations,
  observationMoment,
  type ObservationComparison,
} from "../future/observationComparison";
import {
  exportSurveyResponses,
  type SurveyResponse,
} from "../future/postUseSurvey";
import {
  inspectStorage,
  probeStorage,
  type StorageProbeResult,
  type StorageStatus,
} from "../future/storageCheck";
import { saveFile } from "../notebook/images";

const PostUseSurvey = lazy(async () => ({
  default: (await import("../future/SurveyQuestionnaire")).PostUseSurvey,
}));
const freeObservation = "free-observation";
const sizeFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });

function ObservationTaskSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="observation-tool-field">
      <label htmlFor={id}>観察した特徴</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value={freeObservation}>自由な観察</option>
        {groups.map((group) => (
          <optgroup key={group.id} label={group.name}>
            {tasksForGroup(group.id).map((task) => (
              <option key={task.id} value={task.id}>
                {task.part}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function NoticingTool({ defaultTaskId }: { defaultTaskId: string }) {
  const fieldId = useId();
  const [taskId, setTaskId] = useState(defaultTaskId);
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [revisited, setRevisited] = useState(false);
  const [comparison, setComparison] = useState<ObservationComparison>();
  const hasInput = !!(before.trim() || after.trim() || revisited);

  return (
    <details>
      <summary>描く前・後の気づきを比べる</summary>
      <p>
        設定を閉じてスケッチに戻っても、入力はページを開いている間だけ残ります。
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!hasInput) return;
          const recordedAt = new Date();
          setComparison(
            compareObservations(
              observationMoment(taskId, before, recordedAt),
              observationMoment(taskId, after, recordedAt),
              revisited,
            ),
          );
        }}
      >
        <ObservationTaskSelect
          value={taskId}
          onChange={(id) => {
            setTaskId(id);
            setComparison(undefined);
          }}
        />
        <div className="observation-tool-field">
          <label htmlFor={fieldId + "-before"}>描く前に気づいたこと</label>
          <textarea
            id={fieldId + "-before"}
            rows={3}
            maxLength={200}
            value={before}
            onChange={(event) => {
              setBefore(event.currentTarget.value);
              setComparison(undefined);
            }}
          />
        </div>
        <div className="observation-tool-field">
          <label htmlFor={fieldId + "-after"}>描いた後に気づいたこと</label>
          <textarea
            id={fieldId + "-after"}
            rows={3}
            maxLength={200}
            value={after}
            onChange={(event) => {
              setAfter(event.currentTarget.value);
              setComparison(undefined);
            }}
          />
        </div>
        <label className="consent-check">
          <input
            type="checkbox"
            checked={revisited}
            onChange={(event) => {
              setRevisited(event.currentTarget.checked);
              setComparison(undefined);
            }}
          />
          実物をもう一度見て確かめた
        </label>
        <div className="observation-tool-actions">
          <button className="primary" disabled={!hasInput}>
            気づきを見くらべる
          </button>
          <button
            type="button"
            className="text-button"
            disabled={!hasInput}
            onClick={() => {
              setBefore("");
              setAfter("");
              setRevisited(false);
              setComparison(undefined);
            }}
          >
            入力を消す
          </button>
        </div>
      </form>
      {comparison && (
        <div className="observation-tool-result" aria-live="polite">
          <NoticingComparison value={comparison} />
        </div>
      )}
    </details>
  );
}

function StorageTool() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    status: StorageStatus;
    probe: StorageProbeResult;
  }>();
  const [error, setError] = useState(false);
  const estimate = (bytes?: number) =>
    bytes === undefined ? "不明" : `約${sizeFormat.format(bytes / 2 ** 20)}MB`;
  async function check() {
    setChecking(true);
    setError(false);
    setResult(undefined);
    try {
      const [status, probe] = await Promise.all([
        inspectStorage(),
        probeStorage(),
      ]);
      setResult({ status, probe });
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <details>
      <summary>端末内の保存を確認</summary>
      <p>一時領域で読み書きを試します。観察ノートや設定はそのままです。</p>
      <button
        type="button"
        className="primary"
        disabled={checking}
        onClick={() => void check()}
      >
        保存の読み書きを試す
      </button>
      {checking && <p role="status">保存状態を確認中…</p>}
      {error && <p role="alert">保存状態を確認できませんでした。</p>}
      {result && (
        <div className="observation-tool-result" role="status">
          <p>
            {result.probe.writable
              ? "小さなデータの書き込みと読み取りに成功しました。"
              : "このブラウザで保存の読み書きを確認できませんでした。"}
          </p>
          <dl>
            <dt>このサイト全体の使用量</dt>
            <dd>{estimate(result.status.usageBytes)}</dd>
            <dt>保存上限の目安</dt>
            <dd>{estimate(result.status.quotaBytes)}</dd>
          </dl>
          {result.probe.cleanup === "pending" && (
            <p>確認用の一時領域の片付けを確認できていません。</p>
          )}
        </div>
      )}
    </details>
  );
}

function QuestionnaireTool({ defaultTaskId }: { defaultTaskId: string }) {
  const [taskId, setTaskId] = useState(defaultTaskId);
  const [consent, setConsent] = useState(false);
  const [response, setResponse] = useState<SurveyResponse>();
  const [message, setMessage] = useState("");

  function clearResponse() {
    setConsent(false);
    setResponse(undefined);
    setMessage("");
  }

  async function exportResponse(format: "json" | "csv") {
    if (!consent || !response) return;
    setMessage("");
    try {
      const body = exportSurveyResponses([response], consent, format);
      const mime = format === "json" ? "application/json" : "text/csv";
      const started = await saveFile(
        new Blob([body], { type: mime + ";charset=utf-8" }),
        `zooketch-survey-preview.${format}`,
      );
      setMessage(
        started ? "書き出しを開始しました。" : "書き出しを取りやめました。",
      );
    } catch {
      setMessage("書き出せませんでした。もう一度試してください。");
    }
  }

  return (
    <details>
      <summary>利用後の質問を試す</summary>
      <p>
        4問の試用アンケートです。回答はこのページを開いている間だけ残ります。書き出すと端末にファイルを保存できます。
      </p>
      <p>
        名前や参加者コードは入力しません。研究記録には連携せず、外部への自動送信はありません。
      </p>
      <label className="consent-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            if (event.currentTarget.checked) setConsent(true);
            else clearResponse();
          }}
        />
        説明を読み、試用アンケートの一時記録に同意します
      </label>
      {consent && (
        <>
          <ObservationTaskSelect
            value={taskId}
            onChange={setTaskId}
            disabled={!!response}
          />
          <Suspense fallback={<p role="status">質問を読み込み中…</p>}>
            <PostUseSurvey
              consent={consent}
              taskId={taskId}
              onSave={(record, signal) => {
                if (!signal.aborted) setResponse(record);
              }}
              onSkip={clearResponse}
            />
          </Suspense>
          {response && (
            <>
              <div className="observation-tool-actions">
                <button
                  type="button"
                  onClick={() => void exportResponse("json")}
                >
                  回答をJSONで書き出す
                </button>
                <button
                  type="button"
                  onClick={() => void exportResponse("csv")}
                >
                  回答をCSVで書き出す
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={clearResponse}
                >
                  同意を取り消して回答を消す
                </button>
              </div>
              <p>書き出したファイルは、端末で削除できます。</p>
            </>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </details>
  );
}

export default function ExtraObservationTools({
  defaultTaskId,
}: {
  defaultTaskId?: string;
}) {
  const initialTaskId =
    defaultTaskId && taskById[defaultTaskId] ? defaultTaskId : freeObservation;

  return (
    <section className="observation-tools" aria-label="追加の観察ツール">
      <NoticingTool defaultTaskId={initialTaskId} />
      <StorageTool />
      <QuestionnaireTool defaultTaskId={initialTaskId} />
    </section>
  );
}
