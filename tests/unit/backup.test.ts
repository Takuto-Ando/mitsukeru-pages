import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  createNotebookBackup,
  parseNotebookBackup,
} from "../../src/notebook/backup";
import { observationMetadata } from "../../src/notebook/storage";
import { tasks } from "../../src/content/tasks";
const record = (id = "goat") => {
  const task = tasks.find((t) => t.id === id)!,
    r = task.scene.regions[0];
  return observationMetadata({
    id: "note-" + id,
    taskId: id,
    groupId: task.groupId,
    sceneVersion: 2,
    createdAt: "2026-10-25T00:00:00.000Z",
    outcome: "self-confirmed",
    strokes: [
      [
        { x: r.x * 600, y: r.y * 600 },
        { x: (r.x + r.width / 2) * 600, y: (r.y + r.height / 2) * 600 },
      ],
    ],
  });
};
for (const t of tasks)
  test(`${t.id}: ノートの座標・日時・解説をバックアップで維持`, async () => {
    const before = record(t.id),
      file = await createNotebookBackup([before]);
    const [after] = parseNotebookBackup(await file.text());
    expect(after).toMatchObject({
      id: before.id,
      taskId: t.id,
      createdAt: before.createdAt,
      strokes: before.strokes,
      explanation: before.explanation,
      sceneSnapshot: JSON.parse(JSON.stringify(before.sceneSnapshot)),
    });
  });
test("PNGをバイナリのまま復元し研究・撮影データを含めない", async () => {
  const before = record(),
    data = readFileSync("public/icons/icon-180.png");
  before.ownPng = new Blob([data], { type: "image/png" });
  const file = await createNotebookBackup([
    {
      ...before,
      sessionId: "private-study",
      photo: "camera-photo",
    } as typeof before,
  ]);
  const text = await file.text(),
    [after] = parseNotebookBackup(text);
  expect(text).not.toContain("private-study");
  expect(text).not.toContain("camera-photo");
  expect(new Uint8Array(await after.ownPng!.arrayBuffer())).toEqual(
    new Uint8Array(data),
  );
});
test("途中で壊れたデータ・未知の版・重複IDを拒否", async () => {
  const backup = JSON.parse(
    await (await createNotebookBackup([record()])).text(),
  );
  expect(() => parseNotebookBackup("{")).toThrow();
  expect(() =>
    parseNotebookBackup(JSON.stringify({ ...backup, version: 999 })),
  ).toThrow();
  expect(() =>
    parseNotebookBackup(
      JSON.stringify({
        ...backup,
        observations: [backup.observations[0], backup.observations[0]],
      }),
    ),
  ).toThrow();
  backup.observations.push({
    ...backup.observations[0],
    id: "second",
    taskId: "__proto__",
  });
  expect(() => parseNotebookBackup(JSON.stringify(backup))).toThrow();
});
test("外部素材URL・大きすぎる座標・フレーム違いを拒否", async () => {
  const backup = JSON.parse(
    await (await createNotebookBackup([record()])).text(),
  );
  const changes = [
    {
      sceneSnapshot: {
        ...backup.observations[0].sceneSnapshot,
        answerAsset: "https://example.com/animal.svg",
      },
    },
    {
      strokes: [
        [
          { x: 1, y: 1 },
          { x: 999, y: 1 },
        ],
      ],
    },
    {
      sceneSnapshot: {
        ...backup.observations[0].sceneSnapshot,
        frameHeight: 400,
      },
    },
    { ownPng: "data:image/svg+xml,<svg/>" },
  ];
  for (const change of changes)
    expect(() =>
      parseNotebookBackup(
        JSON.stringify({
          ...backup,
          observations: [{ ...backup.observations[0], ...change }],
        }),
      ),
    ).toThrow();
});
test("破損PNGのCRC・途中までのPNGを拒否", async () => {
  const data = readFileSync("public/icons/icon-180.png"),
    before = record();
  before.ownPng = new Blob([data], { type: "image/png" });
  const backup = JSON.parse(
    await (await createNotebookBackup([before])).text(),
  );
  for (const bytes of [data.subarray(0, 33), Buffer.from(data)]) {
    if (bytes.length > 33) bytes[40] ^= 1;
    backup.observations[0].ownPng =
      "data:image/png;base64," + bytes.toString("base64");
    expect(() => parseNotebookBackup(JSON.stringify(backup))).toThrow();
  }
});

test("旧400座標のノートも全身版へ変換せず復元する", async () => {
  const before = observationMetadata({
    id: "legacy-goat",
    groupId: "goat",
    createdAt: "2026-10-24T00:00:00.000Z",
    outcome: "correct",
    strokes: [
      [
        { x: 200, y: 200 },
        { x: 300, y: 220 },
      ],
    ],
  });
  const [after] = parseNotebookBackup(
    await (await createNotebookBackup([before])).text(),
  );
  expect(after.sceneVersion).toBeUndefined();
  expect(after.strokes).toEqual(before.strokes);
  expect(after.sceneSnapshot.artworkOverride?.incomplete).toBe(
    "illustrations/simple/goat.svg",
  );
});
