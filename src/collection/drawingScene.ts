import { taskById } from "../content/tasks";
import legacy from "../content/partScenes";
import type { Scene } from "../content/scenes";
import type { DrawingRecord } from "./storage";
export function drawingScene(d: DrawingRecord): Scene {
  const id = d.taskId || d.groupId;
  if (d.sceneVersion === 2) return taskById[id].scene;
  const previous = legacy[id as keyof typeof legacy];
  const base = `illustrations/simple/${id}`;
  return {
    ...previous,
    artworkOverride: {
      status: "draft",
      alt: previous.label,
      incomplete: base + ".svg",
      completedBase: base + ".svg",
      answer: base + "-answer.svg",
      explanation: base + "-explanation.svg",
      blankFill: ["elephant", "gorilla", "hippo-body"].includes(id)
        ? "#fbf4e6"
        : "transparent",
      maskInApp: true,
    },
  };
}
