/** Draft research questions, not a validated scale. No storage or network effects. */
export const surveyQuestions = [
  {
    id: "ease",
    text: "描きはじめるのはどうだった？",
    choices: ["むずかしかった", "どちらでもない", "かんたんだった"],
  },
  {
    id: "burden",
    text: "描くのはたいへんだった？",
    choices: [
      "たいへんではなかった",
      "少したいへんだった",
      "とてもたいへんだった",
    ],
  },
  {
    id: "enjoyment",
    text: "動物の特徴を描いて、どうだった？",
    choices: ["楽しくなかった", "どちらでもない", "楽しかった"],
  },
  {
    id: "noticing",
    text: "動物について、何か新しく気づいた？",
    choices: ["気づかなかった", "わからない", "気づいた"],
  },
] as const;
export type SurveyQuestionId = (typeof surveyQuestions)[number]["id"];
export type SurveyAnswers = Partial<Record<SurveyQuestionId, 1 | 2 | 3>>;
export interface SurveyResponse {
  version: 1;
  id: string;
  taskId: string;
  recordedAt: string;
  answers: SurveyAnswers;
}
function checkedCode(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value))
    throw new Error("記録IDと課題IDを確認してください。");
  return value;
}
export function createSurveyResponse(
  input: {
    consent: boolean;
    id: string;
    taskId: string;
    answers: SurveyAnswers;
  },
  now = new Date(),
): SurveyResponse {
  if (input.consent !== true)
    throw new Error("研究参加の説明と同意が必要です。");
  if (!Number.isFinite(now.getTime()))
    throw new Error("記録日時を確認してください。");
  const answers: SurveyAnswers = {};
  for (const [key, answer] of Object.entries(input.answers)) {
    if (
      !surveyQuestions.some((q) => q.id === key) ||
      ![1, 2, 3].includes(answer)
    )
      throw new Error("回答を確認してください。");
    answers[key as SurveyQuestionId] = answer;
  }
  return {
    version: 1,
    id: checkedCode(input.id),
    taskId: checkedCode(input.taskId),
    recordedAt: now.toISOString(),
    answers,
  };
}
function validatedResponses(rows: readonly SurveyResponse[]) {
  if (rows.length > 1000)
    throw new Error("一度に書き出せるのは1000件までです。");
  const ids = new Set<string>();
  return rows.map((row) => {
    if (row.version !== 1 || ids.has(row.id))
      throw new Error("記録の版とIDを確認してください。");
    ids.add(row.id);
    return createSurveyResponse(
      { ...row, consent: true },
      new Date(row.recordedAt),
    );
  });
}
/** Returns data only. The caller must check current consent before providing rows. */
export function exportSurveyResponses(
  rows: readonly SurveyResponse[],
  consent: boolean,
  format: "json" | "csv",
) {
  if (consent !== true) throw new Error("同意が無効な記録は書き出せません。");
  const records = validatedResponses(rows);
  if (format === "json")
    return JSON.stringify(
      {
        format: "zooketch-post-use-survey",
        version: 1,
        questions: surveyQuestions,
        responses: records,
      },
      null,
      2,
    );
  if (format !== "csv") throw new Error("書き出し形式を確認してください。");
  // Every field is validated to an identifier, ISO date or integer; no arbitrary free text.
  const columns = [
    "version",
    "id",
    "taskId",
    "recordedAt",
    ...surveyQuestions.map((q) => q.id),
  ];
  return (
    "\uFEFF" +
    [
      columns,
      ...records.map((r) => [
        r.version,
        r.id,
        r.taskId,
        r.recordedAt,
        ...surveyQuestions.map((q) => r.answers[q.id] ?? ""),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\r\n")
  );
}
