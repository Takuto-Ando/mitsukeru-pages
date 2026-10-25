import type { StudyEvent } from "./study";
export function analyzeStudy(events: StudyEvent[]) {
  const attempts = new Map<
    string,
    {
      sessionId: string;
      attemptId: string;
      phase?: "before" | "after";
      pairId?: string;
      participantCode?: string;
      animalId?: string;
      taskId: string;
      openedAt: string;
      firstDrawingElapsedMs?: number;
      drawingMs: number;
      submissions: number;
      revisions: number;
      hints: number;
      attemptsToSuccess?: number;
      sliderUsed: boolean;
      sliderOperations: number;
      explanationMs: number;
      completed: boolean;
    }
  >();
  const drawing = new Map<string, number>(),
    explanation = new Map<string, number>(),
    lastSeen = new Map<string, number>();
  const sorted = [...events].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.sequence - b.sequence,
  );
  for (const e of sorted) {
    const at = Date.parse(e.timestamp);
    if (e.event === "session_completed") {
      for (const [id, start] of drawing) {
        const a = attempts.get(id);
        if (a && a.sessionId === e.sessionId) {
          a.drawingMs += Math.max(0, at - start);
          drawing.delete(id);
        }
      }
      for (const [id, start] of explanation) {
        const a = attempts.get(id);
        if (a && a.sessionId === e.sessionId) {
          a.explanationMs += Math.max(0, at - start);
          explanation.delete(id);
        }
      }
    }
    if (!e.attemptId || !e.taskId) continue;
    const id = e.attemptId;
    lastSeen.set(id, at);
    if (e.event === "challenge_opened")
      attempts.set(id, {
        sessionId: e.sessionId,
        attemptId: id,
        phase: e.phase,
        pairId: e.pairId,
        participantCode: e.participantCode,
        animalId: e.animalId,
        taskId: e.taskId,
        openedAt: e.timestamp,
        drawingMs: 0,
        submissions: 0,
        revisions: 0,
        hints: 0,
        sliderUsed: false,
        sliderOperations: 0,
        explanationMs: 0,
        completed: false,
      });
    const a = attempts.get(id);
    if (!a) continue;
    if (e.event === "drawing_started" && e.details?.tool !== "eraser") {
      if (a.firstDrawingElapsedMs === undefined)
        a.firstDrawingElapsedMs = Math.max(0, at - Date.parse(a.openedAt));
      if (!drawing.has(id)) drawing.set(id, at);
    }
    if (
      e.event === "drawing_stopped" ||
      e.event === "drawing_submitted" ||
      e.event === "challenge_left"
    ) {
      const start = drawing.get(id);
      if (start !== undefined) a.drawingMs += Math.max(0, at - start);
      drawing.delete(id);
    }
    if (e.event === "drawing_submitted") a.submissions++;
    if (["drawing_cleared", "drawing_undo", "drawing_erased"].includes(e.event))
      a.revisions++;
    if (e.event === "hint_opened") a.hints++;
    if (
      e.event === "evaluation_completed" &&
      e.details?.status === "correct" &&
      a.attemptsToSuccess === undefined
    )
      a.attemptsToSuccess = a.submissions;
    if (e.event === "comparison_slider_moved") {
      a.sliderUsed = true;
      a.sliderOperations++;
    }
    if (e.event === "explanation_opened") {
      if (!explanation.has(id)) explanation.set(id, at);
      a.completed = true;
    }
    if (e.event === "explanation_closed" || e.event === "challenge_left") {
      const start = explanation.get(id);
      if (start !== undefined) a.explanationMs += Math.max(0, at - start);
      explanation.delete(id);
    }
    if (e.event === "challenge_completed") a.completed = true;
  }
  for (const [id, start] of explanation) {
    const a = attempts.get(id);
    const end = lastSeen.get(id);
    if (a && end !== undefined && end >= start) {
      a.explanationMs += end - start;
    }
  }
  const rows = [...attempts.values()];
  return {
    attempts: rows,
    completionRate: rows.length
      ? rows.filter((a) => a.completed).length / rows.length
      : null,
  };
}
