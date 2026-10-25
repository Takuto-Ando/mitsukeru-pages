import type { Stroke, Evaluation } from "./types";
import { taskById, tasksForGroup, type ObservationTask } from "./content/tasks";
import { clipStrokes } from "./content/scenes";
import { evaluateProfile } from "./content/profiles";
import { evaluateObservation } from "./evaluator";

export interface ChallengeProvider {
  forSpecies(speciesId: string): ObservationTask[];
  byId(id: string): ObservationTask | undefined;
}
export const challengeProvider: ChallengeProvider = {
  forSpecies: (id) => (id === "sheep" ? [taskById.sheep] : tasksForGroup(id)),
  byId: (id) => taskById[id],
};
export type DrawingEvaluation = Evaluation & {
  challengeId: string;
  status: "correct" | "uncertain" | "retry";
  // Reserved for calibration. Zero means uncalibrated, not an accuracy score.
  confidence: number;
  feedback: string;
};
export interface DrawingEvaluator {
  evaluate(task: ObservationTask, strokes: Stroke[]): DrawingEvaluation;
}
export const drawingEvaluator: DrawingEvaluator = {
  evaluate(task, strokes) {
    const visible = clipStrokes(strokes, task.scene);
    let result: Evaluation;
    if (!task.automatic || !visible.length)
      result = {
        passed: false,
        status: "uncertain",
        method: "comparison",
        message: "見えた形を見くらべよう。",
        suggestion: task.hint,
      };
    else {
      result = task.profile
        ? evaluateProfile(visible, task.profile, task.scene)
        : evaluateObservation(visible);
      result.method = "automatic";
    }
    return {
      ...result,
      challengeId: task.id,
      status: result.status || "uncertain",
      confidence: 0,
      feedback: result.message,
    };
  },
};
