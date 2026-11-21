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
  /** Optional participant self-report, never an automatic observation score. */
  discovery?: string;
  /** 子どもの声の発表（録音）。端末内だけに保存される。 */
  voiceNote?: Blob;
  revisited?: boolean;
  migrated?: boolean;
}
