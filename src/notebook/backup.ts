import { taskById } from "../content/tasks";
import type { Scene, Region } from "../content/scenes";
import type { Artwork } from "../content/artwork";
import type { ObservationRecord } from "./types";

export const backupLimits = {
  bytes: 50 * 1024 * 1024,
  records: 500,
  points: 100_000,
  imageBytes: 8 * 1024 * 1024,
};
const imageKeys = ["ownPng", "answerPng", "comparisonPng"] as const;
const invalid = () =>
  new Error(
    "バックアップの内容を確認できませんでした。ズーケッチから書き出したファイルを選んでください。",
  );
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as ObjectValue;
}
function text(value: unknown, max = 2000): string {
  if (typeof value !== "string" || value.length > max) throw invalid();
  return value;
}
function asset(value: unknown): string | undefined {
  if (value === undefined) return;
  const path = text(value, 300);
  if (
    !/^(illustrations|media)\/[a-zA-Z0-9_/-]+\.(svg|png|jpg|jpeg|webp)$/.test(
      path,
    )
  )
    throw invalid();
  return path;
}
function regions(value: unknown, allowEmpty = false): Region[] {
  if (
    !Array.isArray(value) ||
    value.length > 64 ||
    (!allowEmpty && !value.length)
  )
    throw invalid();
  return value.map((item) => {
    const r = object(item),
      { x, y, width, height } = r;
    if (
      ![x, y, width, height].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) ||
      Number(x) < 0 ||
      Number(y) < 0 ||
      Number(width) <= 0 ||
      Number(height) <= 0 ||
      Number(x) + Number(width) > 1.000001 ||
      Number(y) + Number(height) > 1.000001
    )
      throw invalid();
    return {
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
    };
  });
}
function scene(value: unknown, id: string): Scene {
  const s = object(value);
  if (
    s.id !== id ||
    (s.frameHeight !== undefined && ![400, 600].includes(Number(s.frameHeight)))
  )
    throw invalid();
  const result: Scene = {
    id,
    label: text(s.label, 200),
    regions: regions(s.regions),
  };
  if (s.frameHeight !== undefined) result.frameHeight = Number(s.frameHeight);
  if (s.maskHoles !== undefined) result.maskHoles = regions(s.maskHoles, true);
  if (s.answerAsset !== undefined) result.answerAsset = asset(s.answerAsset);
  if (s.photo !== undefined) result.photo = asset(s.photo);
  for (const key of ["background", "answerPath"] as const)
    if (s[key] !== undefined) result[key] = text(s[key], 30_000);
  if (s.artworkOverride !== undefined) {
    const a = object(s.artworkOverride);
    if (!["draft", "reviewed", "awaiting"].includes(String(a.status)))
      throw invalid();
    const art: Artwork = {
      status: a.status as Artwork["status"],
      alt: text(a.alt, 300),
    };
    for (const key of [
      "reference",
      "incomplete",
      "completedBase",
      "answer",
      "explanation",
    ] as const)
      if (a[key] !== undefined) art[key] = asset(a[key]);
    if (a.blankFill !== undefined) {
      const color = text(a.blankFill, 30);
      if (!/^(transparent|#[0-9a-fA-F]{3,8})$/.test(color)) throw invalid();
      art.blankFill = color;
    }
    if (a.maskInApp !== undefined) {
      if (typeof a.maskInApp !== "boolean") throw invalid();
      art.maskInApp = a.maskInApp;
    }
    for (const key of ["credit", "reviewedBy"] as const)
      if (a[key] !== undefined) art[key] = text(a[key]);
    result.artworkOverride = art;
  }
  return result;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function validPngChunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer);
  let offset = 8,
    sawData = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset),
      end = offset + 8 + length;
    if (end + 4 > bytes.length) return false;
    let crc = 0xffffffff;
    for (let i = offset + 4; i < end; i++)
      crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(end)) return false;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (offset === 8 && (type !== "IHDR" || length !== 13)) return false;
    if (type === "IDAT") sawData = true;
    if (type === "IEND")
      return length === 0 && end + 4 === bytes.length && sawData;
    offset = end + 4;
  }
  return false;
}
function pngFromData(value: unknown): Blob {
  const encoded = text(
    value,
    Math.ceil((backupLimits.imageBytes * 4) / 3) + 100,
  );
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw invalid();
  let binary: string;
  try {
    binary = atob(encoded.slice(encoded.indexOf(",") + 1));
  } catch {
    throw invalid();
  }
  if (binary.length > backupLimits.imageBytes || binary.length < 33)
    throw invalid();
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  if (
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  )
    throw invalid();
  if (!validPngChunks(bytes)) throw invalid();
  const view = new DataView(bytes.buffer),
    width = view.getUint32(16),
    height = view.getUint32(20);
  if (
    !width ||
    !height ||
    width > 4096 ||
    height > 4096 ||
    width * height > 12_000_000
  )
    throw invalid();
  return new Blob([bytes], { type: "image/png" });
}
export function parseNotebookBackup(raw: string): ObservationRecord[] {
  if (new Blob([raw]).size > backupLimits.bytes)
    throw new Error(
      "バックアップが大きすぎます。50MB以下のファイルを選んでください。",
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw invalid();
  }
  const root = object(parsed);
  if (
    root.format !== "zooketch-observation-notes" ||
    root.version !== 1 ||
    !Array.isArray(root.observations) ||
    root.observations.length > backupLimits.records
  )
    throw invalid();
  const ids = new Set<string>();
  return root.observations.map((value) => {
    const d = object(value),
      id = text(d.id, 128),
      taskId = text(d.taskId, 100);
    if (
      !/^[A-Za-z0-9_-]+$/.test(id) ||
      ids.has(id) ||
      !Object.hasOwn(taskById, taskId)
    )
      throw invalid();
    ids.add(id);
    const task = taskById[taskId];
    if (
      d.groupId !== task.groupId ||
      (d.sceneVersion !== undefined && d.sceneVersion !== 2) ||
      !["correct", "self-confirmed"].includes(String(d.outcome))
    )
      throw invalid();
    const createdAt = text(d.createdAt, 40);
    if (
      !/^\d{4}-\d{2}-\d{2}T/.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt))
    )
      throw invalid();
    if (
      !Array.isArray(d.strokes) ||
      !d.strokes.length ||
      d.strokes.length > 5000
    )
      throw invalid();
    let points = 0;
    const strokes = d.strokes.map((value) => {
      if (
        !Array.isArray(value) ||
        value.length < 2 ||
        (points += value.length) > backupLimits.points
      )
        throw invalid();
      return value.map((value) => {
        const p = object(value);
        if (
          typeof p.x !== "number" ||
          typeof p.y !== "number" ||
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          p.x < 0 ||
          p.x > 600 ||
          p.y < 0 ||
          p.y > (d.sceneVersion === 2 ? 600 : 400)
        )
          throw invalid();
        return { x: p.x, y: p.y };
      });
    });
    const snapshot = scene(d.sceneSnapshot, taskId);
    if ((snapshot.frameHeight || 400) !== (d.sceneVersion === 2 ? 600 : 400))
      throw invalid();
    const e = object(d.explanation);
    const record: ObservationRecord = {
      id,
      groupId: task.groupId,
      taskId,
      createdAt,
      strokes,
      outcome: d.outcome as ObservationRecord["outcome"],
      animalName: text(d.animalName, 200),
      taskName: text(d.taskName, 200),
      explanation: {
        name: text(e.name, 200),
        form: text(e.form),
        ecology: text(e.ecology),
      },
      question: text(d.question),
      sceneSnapshot: snapshot,
    };
    if (d.sceneVersion === 2) record.sceneVersion = 2;
    if (e.role !== undefined) record.explanation.role = text(e.role);
    for (const key of imageKeys)
      if (d[key] !== undefined) record[key] = pngFromData(d[key]);
    return record;
  });
}
async function pngData(blob: Blob) {
  if (blob.type !== "image/png" || blob.size > backupLimits.imageBytes)
    throw invalid();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return "data:image/png;base64," + btoa(binary);
}
export async function createNotebookBackup(records: ObservationRecord[]) {
  if (records.length > backupLimits.records)
    throw new Error(
      "一度に書き出せるのは500件までです。PNGでも個別に残せます。",
    );
  const observations = [];
  for (const record of records) {
    const copy: Record<string, unknown> = {
      id: record.id,
      taskId: record.taskId,
      groupId: record.groupId,
      sceneVersion: record.sceneVersion,
      createdAt: record.createdAt,
      strokes: record.strokes,
      outcome: record.outcome,
      animalName: record.animalName,
      taskName: record.taskName,
      explanation: record.explanation,
      question: record.question,
      sceneSnapshot: record.sceneSnapshot,
    };
    for (const key of imageKeys)
      if (record[key]) copy[key] = await pngData(record[key]!);
    observations.push(copy);
  }
  const blob = new Blob(
    [
      JSON.stringify({
        format: "zooketch-observation-notes",
        version: 1,
        exportedAt: new Date().toISOString(),
        observations,
      }),
    ],
    { type: "application/json" },
  );
  if (blob.size > backupLimits.bytes)
    throw new Error(
      "バックアップが50MBを超えています。PNGで個別に保存してください。",
    );
  return blob;
}
