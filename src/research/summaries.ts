import type { ResearchEvent } from "./recorder";
export interface TaskSummary {
  taskId: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  drawingMs: number;
  revisions: number;
  hintsUsed: boolean;
  judgments: string[];
  selfConfirmed: boolean;
  explanationViewed: boolean;
}
// Each start creates a separate attempt, even for the same animal. No inferred scores.
export function summarizeResearch(events: ResearchEvent[]): TaskSummary[] {
  const results: TaskSummary[] = [];
  let active: TaskSummary | undefined, contact: number | undefined;
  const closeContact = (at: number) => {
    if (active && contact !== undefined)
      active.drawingMs += Math.max(0, at - contact);
    contact = undefined;
  };
  for (const event of events) {
    const at = Date.parse(event.at);
    if (event.event === "start") {
      closeContact(at);
      active = {
        taskId: event.taskId,
        startedAt: event.at,
        drawingMs: 0,
        revisions: 0,
        hintsUsed: false,
        judgments: [],
        selfConfirmed: false,
        explanationViewed: false,
      };
      results.push(active);
    }
    if (!active || active.taskId !== event.taskId) continue;
    if (event.event === "drawing-start" && contact === undefined) contact = at;
    if (event.event === "drawing-end") closeContact(at);
    if (event.event === "revision") active.revisions++;
    if (event.event === "hint") active.hintsUsed = true;
    if (event.event === "judgment")
      active.judgments.push(event.detail || "unspecified");
    if (event.event === "self-confirmation") active.selfConfirmed = true;
    if (event.event === "explanation") active.explanationViewed = true;
    if (event.event === "end") {
      closeContact(at);
      active.endedAt = event.at;
      active.durationMs = Math.max(0, at - Date.parse(active.startedAt));
      active = undefined;
    }
  }
  return results;
}
