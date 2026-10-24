import type { Stroke } from "../types";
export type DrawingAction = "draw" | "erase" | "clear";
export interface DrawingHistory {
  present: Stroke[];
  past: Stroke[][];
}
export type HistoryAction =
  { type: "commit"; strokes: Stroke[] } | { type: "undo" } | { type: "reset" };
export const emptyDrawing = (): DrawingHistory => ({ present: [], past: [] });
// Store completed operations, never pointer samples. Undo restores erased lines too.
export function drawingHistory(
  state: DrawingHistory,
  action: HistoryAction,
): DrawingHistory {
  if (action.type === "reset") return emptyDrawing();
  if (action.type === "undo")
    return state.past.length
      ? {
          present: state.past[state.past.length - 1],
          past: state.past.slice(0, -1),
        }
      : state;
  if (action.strokes === state.present) return state;
  return {
    present: action.strokes,
    past: [...state.past.slice(-49), state.present],
  };
}
