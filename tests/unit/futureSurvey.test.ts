import { test, expect } from "vitest";
import {
  createSurveyResponse,
  exportSurveyResponses,
} from "../../src/future/postUseSurvey";
const input = () => ({
  consent: true,
  id: "record-1",
  taskId: "goat",
  answers: { ease: 3 as const, burden: 1 as const },
});
test("同意必須・未回答は欠測・入力と記録を分離", () => {
  const value = input();
  expect(() => createSurveyResponse({ ...value, consent: false })).toThrow();
  const record = createSurveyResponse(value, new Date("2026-10-30T00:00:00Z"));
  expect(record.answers.enjoyment).toBeUndefined();
  expect(createSurveyResponse({ ...value, answers: {} }).answers).toEqual({});
  value.answers.ease = 1 as unknown as 3;
  expect(record.answers.ease).toBe(3);
});
test("任意の値や質問、日時、IDを受け入れない", () => {
  expect(() =>
    createSurveyResponse({ ...input(), answers: { ease: 0 } as any }),
  ).toThrow();
  expect(() =>
    createSurveyResponse({ ...input(), answers: { email: 3 } as any }),
  ).toThrow();
  expect(() =>
    createSurveyResponse({ ...input(), answers: { ease: undefined } as any }),
  ).toThrow();
  expect(() => createSurveyResponse(input(), new Date(NaN))).toThrow();
  expect(() => createSurveyResponse({ ...input(), id: "=formula" })).toThrow();
});
test("JSON・CSV出力の欠測を保持し、自由記述や余分な属性を出力しない", () => {
  const row = {
    ...createSurveyResponse(input()),
    email: "secret@example.test",
  };
  const json = exportSurveyResponses([row], true, "json");
  expect(json).not.toContain("secret");
  expect(JSON.parse(json).questions).toHaveLength(4);
  const csv = exportSurveyResponses([row], true, "csv");
  expect(csv.split("\r\n")[1]).toMatch(/,3,1,,$/);
  expect(() => exportSurveyResponses([row], false, "csv")).toThrow();
  expect(() => exportSurveyResponses([row, row], true, "json")).toThrow();
  expect(() =>
    exportSurveyResponses([{ ...row, version: 2 } as any], true, "json"),
  ).toThrow();
});
