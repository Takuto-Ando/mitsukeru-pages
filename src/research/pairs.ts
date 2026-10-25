import type { Evaluation, Stroke } from "../types";
import type { Scene } from "../content/scenes";
import { composeObservationImages } from "../notebook/images";
import { analyzeStudy } from "./analysis";
import {
  currentStudyContext,
  studyEvents,
  studyStatus,
  saveStudyPair,
} from "./study";
export interface StudyDrawing {
  image: string;
  evaluation: Evaluation;
  capturedAt: string;
  metrics?: ReturnType<typeof analyzeStudy>["attempts"][number];
}
export interface StudyPair {
  id: string;
  taskId: string;
  before: StudyDrawing;
  after: StudyDrawing;
}
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
export async function captureStudyDrawing(
  scene: Scene,
  strokes: Stroke[],
  evaluation: Evaluation,
): Promise<StudyDrawing> {
  if (!studyStatus().collecting || !studyStatus().comparisonStudy)
    throw new Error("研究モードが停止しています。");
  const context = currentStudyContext();
  if (context.taskId !== scene.id || !context.phase || !context.pairId)
    throw new Error("同意後に新しい課題を始めてください。");
  const { ownPng } = await composeObservationImages(scene, strokes);
  const analysis = analyzeStudy(await studyEvents());
  return {
    image: await dataUrl(ownPng),
    evaluation: structuredClone(evaluation),
    capturedAt: new Date().toISOString(),
    metrics: analysis.attempts.find((a) => a.attemptId === context.attemptId),
  };
}
export { saveStudyPair };
