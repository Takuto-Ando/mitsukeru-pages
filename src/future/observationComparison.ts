/** Optional self-reported observations. No scoring, logging or storage side effects. */
export interface ObservationMoment {
  taskId: string;
  recordedAt: string;
  noticing: string;
}
export interface ObservationComparison {
  before: ObservationMoment;
  after: ObservationMoment;
  revisitedSelfReport: boolean;
}
export function observationMoment(
  taskId: string,
  noticing: string,
  now = new Date(),
): ObservationMoment {
  if (!taskId.trim() || taskId.length > 100 || !Number.isFinite(now.getTime()))
    throw new Error("課題と記録日時を確認してください。");
  if (noticing.length > 200)
    throw new Error("気づきは200文字以内で入力してください。");
  return { taskId, noticing: noticing.trim(), recordedAt: now.toISOString() };
}
export function compareObservations(
  before: ObservationMoment,
  after: ObservationMoment,
  revisitedSelfReport = false,
): ObservationComparison {
  // Validate even restored or externally supplied values.
  const first = observationMoment(
    before.taskId,
    before.noticing,
    new Date(before.recordedAt),
  );
  const last = observationMoment(
    after.taskId,
    after.noticing,
    new Date(after.recordedAt),
  );
  if (
    first.taskId !== last.taskId ||
    Date.parse(last.recordedAt) < Date.parse(first.recordedAt)
  )
    throw new Error("同じ課題の、描く前と後の記録を選んでください。");
  return { before: first, after: last, revisitedSelfReport };
}
