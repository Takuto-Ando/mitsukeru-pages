import type { StudyPair } from "./pairs";
import {
  database,
  getAll,
  requestValue,
  transactionDone,
} from "../notebook/database";
import { downloadBlob } from "../notebook/images";
import { analyzeStudy } from "./analysis";

export type StudyEventName =
  | "session_started"
  | "animal_photographed"
  | "animal_identified"
  | "challenge_opened"
  | "hint_opened"
  | "drawing_started"
  | "drawing_stopped"
  | "drawing_submitted"
  | "drawing_cleared"
  | "drawing_undo"
  | "drawing_erased"
  | "evaluation_completed"
  | "comparison_opened"
  | "comparison_slider_moved"
  | "explanation_opened"
  | "explanation_closed"
  | "observation_saved"
  | "session_completed"
  | "challenge_completed"
  | "challenge_left"
  | "study_pair_completed";

export interface StudyEvent {
  id: string;
  sessionId: string;
  participantCode?: string;
  sequence: number;
  event: StudyEventName;
  timestamp: string;
  animalId?: string;
  taskId?: string;
  attemptId?: string;
  phase?: "before" | "after";
  pairId?: string;
  details?: Record<string, string | number | boolean>;
}

interface Control {
  id: "research-consent";
  token: string;
  participantCode?: string;
  consented: boolean;
  collecting: boolean;
}

interface Status {
  ready: boolean;
  consented: boolean;
  collecting: boolean;
  participantCode?: string;
  comparisonStudy: boolean;
  error: string;
}

let state: Status = {
  comparisonStudy: false,
  ready: false,
  consented: false,
  collecting: false,
  participantCode: undefined,
  error: "",
};
let sequence = 0;
let token = "",
  sessionId = "",
  participantCode = "",
  context: {
    animalId?: string;
    taskId?: string;
    attemptId?: string;
    phase?: "before" | "after";
    pairId?: string;
  } = {};
let queue = Promise.resolve();
const listeners = new Set<() => void>();
const publish = (next: Partial<Status>) => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
};

export const studyStatus = () => state;
export const subscribeStudy = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function sanitizeParticipantCode(input = "") {
  const cleaned = input
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 24);
  return cleaned || `P-${crypto.randomUUID().slice(0, 8)}`;
}

const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("zooketch-study-consent")
    : undefined;
channel?.addEventListener("message", (e) => {
  publish({
    collecting: false,
    comparisonStudy: false,
    ...(e.data === "withdrawn"
      ? { consented: false, participantCode: undefined }
      : {}),
  });
});

let initialized: Promise<void> | undefined;
export function initializeStudy() {
  return (initialized ||= (async () => {
    try {
      const db = await database(),
        tx = db.transaction("settings", "readonly"),
        done = transactionDone(tx);
      const control = await requestValue<Control | undefined>(
        tx.objectStore("settings").get("research-consent"),
      );
      await done;
      // Every page load starts stopped. Existing logs can be explicitly exported or deleted.
      publish({
        ready: true,
        consented: !!control?.consented,
        collecting: false,
        participantCode: control?.participantCode,
      });
    } catch {
      publish({
        error: "研究用の保存領域を開けませんでした。通常の観察は利用できます。",
      });
    }
  })());
}

const allowed = new Set([
  "method",
  "status",
  "hintLevel",
  "from",
  "to",
  "via",
  "tool",
  "reason",
  "empty",
  "completed",
  "submission",
]);

export function safeStudyDetails(details: Record<string, unknown> = {}) {
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(details))
    if (
      allowed.has(key) &&
      (typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "string" && value.length <= 80))
    )
      clean[key] = value as string | number | boolean;
  return clean;
}

function enqueue(work: () => Promise<void>) {
  queue = queue.then(work).catch(() => {
    publish({
      collecting: false,
      error:
        "研究ログを保存できなかったため、記録を停止しました。保存容量を確認してください。",
    });
  });
  return queue;
}

export const currentStudyContext = () => ({ ...context });
export function setStudyContext(
  animalId?: string,
  taskId?: string,
  phase?: "before" | "after",
  pairId?: string,
) {
  context = {
    animalId,
    taskId,
    phase,
    pairId,
    attemptId: taskId ? crypto.randomUUID() : undefined,
  };
}

export function recordStudy(
  event: StudyEventName,
  details: Record<string, unknown> = {},
  override?: Partial<typeof context>,
) {
  if (!state.collecting) return;
  const ownToken = token;
  const data: StudyEvent = {
    id: crypto.randomUUID(),
    sessionId,
    participantCode: participantCode || state.participantCode,
    sequence: ++sequence,
    event,
    timestamp: new Date().toISOString(),
    ...context,
    ...override,
    details: safeStudyDetails(details),
  };
  return enqueue(async () => {
    const db = await database(),
      tx = db.transaction(["settings", "researchEvents"], "readwrite"),
      done = transactionDone(tx);
    const request = tx.objectStore("settings").get("research-consent");
    request.onsuccess = () => {
      const c = request.result as Control | undefined;
      if (c?.consented && c.collecting && c.token === ownToken)
        tx.objectStore("researchEvents").add(data);
    };
    await done;
  });
}

export async function startStudy(
  consent: boolean,
  rawParticipantCode?: string,
  comparisonStudy = false,
) {
  if (consent !== true) throw new Error("説明への同意が必要です。");
  await initializeStudy();
  if (!state.ready) throw new Error("研究用の保存領域を開けません。");
  await queue;
  token = crypto.randomUUID();
  sessionId = crypto.randomUUID();
  participantCode = sanitizeParticipantCode(rawParticipantCode);
  sequence = 0;
  context = {};
  const db = await database(),
    tx = db.transaction("settings", "readwrite"),
    done = transactionDone(tx);
  tx.objectStore("settings").put({
    id: "research-consent",
    token,
    participantCode,
    consented: true,
    collecting: true,
  } satisfies Control);
  await done;
  channel?.postMessage("new-session");
  publish({
    consented: true,
    collecting: true,
    comparisonStudy,
    participantCode,
    error: "",
  });
  await recordStudy("session_started");
}

export async function stopStudy() {
  if (state.collecting) await recordStudy("session_completed");
  publish({ collecting: false, comparisonStudy: false });
  await enqueue(async () => {
    const db = await database(),
      tx = db.transaction("settings", "readwrite"),
      done = transactionDone(tx);
    const req = tx.objectStore("settings").get("research-consent");
    req.onsuccess = () => {
      if (req.result?.token === token)
        tx.objectStore("settings").put({ ...req.result, collecting: false });
    };
    await done;
  });
  channel?.postMessage("stopped");
}

export async function withdrawStudy() {
  publish({ collecting: false, comparisonStudy: false });
  channel?.postMessage("withdrawn");
  await queue;
  const db = await database(),
    tx = db.transaction(["settings", "researchEvents"], "readwrite"),
    done = transactionDone(tx);
  tx.objectStore("settings").put({
    id: "research-consent",
    token: crypto.randomUUID(),
    participantCode: undefined,
    consented: false,
    collecting: false,
  } satisfies Control);
  tx.objectStore("researchEvents").clear();
  const cursor = tx.objectStore("settings").openCursor();
  cursor.onsuccess = () => {
    const c = cursor.result;
    if (c) {
      if (String(c.key).startsWith("study-pair:")) c.delete();
      c.continue();
    }
  };
  await done;
  context = {};
  participantCode = "";
  publish({ consented: false, participantCode: undefined, error: "" });
}

export async function studyEvents() {
  await queue;
  return (await getAll<StudyEvent>("researchEvents")).sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.sequence - b.sequence,
  );
}

export function studyCsv(events: StudyEvent[]) {
  const fields = [
    "id",
    "sessionId",
    "participantCode",
    "sequence",
    "event",
    "timestamp",
    "animalId",
    "taskId",
    "attemptId",
    "phase",
    "pairId",
    "method",
    "status",
    "hintLevel",
    "from",
    "to",
    "via",
    "tool",
    "reason",
    "empty",
    "completed",
    "submission",
  ];
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      fields.map(cell).join(","),
      ...events.map((e) =>
        fields
          .map((key) =>
            cell(key in e ? e[key as keyof StudyEvent] : e.details?.[key]),
          )
          .join(","),
      ),
    ].join("\r\n")
  );
}

export async function exportStudy(format: "json" | "csv") {
  const events = await studyEvents();
  const pairs = (await getAll<{ id: string }>("settings")).filter((row) =>
    row.id.startsWith("study-pair:"),
  );
  if (!events.length) throw new Error("書き出す研究ログがありません。");
  const text =
    format === "json"
      ? JSON.stringify(
          {
            schemaVersion: 1,
            participantCode: state.participantCode,
            events,
            analysis: analyzeStudy(events),
            pairs,
          },
          null,
          2,
        )
      : studyCsv(events);
  downloadBlob(
    new Blob([text], {
      type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
    }),
    `zooketch-study-${new Date().toISOString().slice(0, 10)}.${format}`,
  );
}

// Image storage is a separate, explicit consent scope. Check session token atomically.
export async function saveStudyPair(pair: StudyPair) {
  if (!state.collecting || !state.comparisonStudy)
    throw new Error("研究モードが停止しています。");
  await queue;
  const ownToken = token,
    db = await database();
  const tx = db.transaction("settings", "readwrite"),
    done = transactionDone(tx);
  let stored = false;
  const request = tx.objectStore("settings").get("research-consent");
  request.onsuccess = () => {
    const control = request.result as Control | undefined;
    if (
      control?.token === ownToken &&
      control.consented &&
      control.collecting &&
      state.collecting &&
      state.comparisonStudy
    ) {
      tx.objectStore("settings").put({
        ...pair,
        id: "study-pair:" + pair.id,
        sessionId,
        participantCode,
      });
      stored = true;
    }
  };
  await done;
  if (!stored)
    throw new Error("同意が撤回されたため、描画記録は保存しませんでした。");
  await recordStudy("study_pair_completed");
}
