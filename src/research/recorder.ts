import { summarizeResearch } from "./summaries";
export interface ResearchEvent {
  taskId: string;
  event:
    | "start"
    | "drawing-start"
    | "drawing-end"
    | "drawing"
    | "revision"
    | "hint"
    | "judgment"
    | "self-confirmation"
    | "explanation"
    | "end";
  at: string;
  elapsedMs: number;
  detail?: string;
}
// No URL switch, automatic consent, persistent identifier, photo or drawing capture.
// The study facilitator must call enable only after explaining the study and obtaining consent.
export function createResearchRecorder(clock: () => number = () => Date.now()) {
  let enabled = false,
    started = 0;
  let events: ResearchEvent[] = [];
  return {
    enable(consent: { obtained: boolean }) {
      if (consent.obtained !== true) throw new Error("Consent required");
      enabled = true;
      started = clock();
      events = [];
    },
    disable() {
      enabled = false;
      events = [];
    },
    record(taskId: string, event: ResearchEvent["event"], detail?: string) {
      if (enabled) {
        const at = clock();
        events.push({
          taskId,
          event,
          at: new Date(at).toISOString(),
          elapsedMs: at - started,
          detail,
        });
      }
    },
    export() {
      return enabled ? structuredClone(events) : [];
    },
    summaries() {
      return enabled ? summarizeResearch(events) : [];
    },
    get enabled() {
      return enabled;
    },
  };
}
export const researchRecorder = createResearchRecorder();

// Explicit study build only; no recording starts until the facilitator enables it.
if (import.meta.env.VITE_ENABLE_STUDY_TOOLS === "true")
  Object.defineProperty(window, "zooketchStudy", {
    value: researchRecorder,
    configurable: true,
  });
