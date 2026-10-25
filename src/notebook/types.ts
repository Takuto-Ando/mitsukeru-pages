import type { DrawingRecord } from "../collection/storage";
import type { Scene } from "../content/scenes";
export interface ObservationRecord extends DrawingRecord {
  animalName: string;
  taskName: string;
  explanation: { name: string; form: string; ecology: string; role?: string };
  question: string;
  sceneSnapshot: Scene;
  ownPng?: Blob;
  answerPng?: Blob;
  comparisonPng?: Blob;
  migrated?: boolean;
}
