export interface ObservationParameters {
  minAspect: number;
  verticalAspect: number;
  trim: number;
  minHeight: number;
  minWidth: number;
}
export type Point = { x: number; y: number };
export type Stroke = Point[];
export interface Challenge {
  animalId: string;
  animalName: string;
  challengeId: string;
  title: string;
  observationInstruction: string;
  drawingTemplate: "eye" | "blank" | "body";
  evaluationType: "horizontal";
  observationParameters: ObservationParameters;
  hint: string[];
  explanation: {
    name: string;
    fact: string;
    role: string;
    ecology: string;
    question: string;
    certainty: string;
  };
  difficulty: 1 | 2;
  scientificSource: { title: string; url: string }[];
  tags: string[];
}
export interface Evaluation {
  method?: "automatic" | "self-confirmed" | "comparison";
  debug?: {
    turn?: number;
    horizontal?: number;
    vertical?: number;
    regions?: { width: number; height: number }[];
    cue: string;
    width: number;
    height: number;
    strokes: number;
    automaticJudging: string;
  };
  status?: "correct" | "uncertain" | "retry";
  passed: boolean;
  message: string;
  suggestion?: string;
}
export interface ShapeEvaluator {
  evaluate(strokes: Stroke[], challenge: Challenge): Evaluation;
}
