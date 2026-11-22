export function challengeTitle(taskId: string, animal: string, part: string) {
  return taskId === "giraffe" ? "キリンの舌" : `${animal}の${part}`;
}
