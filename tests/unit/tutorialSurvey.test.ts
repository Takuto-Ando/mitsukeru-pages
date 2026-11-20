import { expect, test } from "vitest";
import { tutorialSurveyUrl } from "../../src/research/tutorialSurvey";

const form = "https://docs.google.com/forms/d/e/test-response/viewform";

test("検証用URLのときだけ公開設定のGoogleフォームへ案内する", () => {
  expect(tutorialSurveyUrl("", form)).toBeUndefined();
  expect(tutorialSurveyUrl("?study=0", form)).toBeUndefined();
  expect(tutorialSurveyUrl("?study=1")).toBeUndefined();
  expect(tutorialSurveyUrl("?study=1&form=https://example.com", form)).toBe(
    form,
  );
  expect(tutorialSurveyUrl("?study=1", form + "?entry.123=sample#header")).toBe(
    form,
  );
  expect(tutorialSurveyUrl("?study=1", "https://forms.gle/exampleForm")).toBe(
    "https://forms.gle/exampleForm",
  );
});

test.each([
  "http://forms.gle/example",
  "https://forms.gle.example.com/example",
  "https://docs.google.com/forms/d/e/test-response/edit",
  "https://example.com/forms/d/e/test-response/viewform",
  "https://user:secret@docs.google.com/forms/d/e/test-response/viewform",
  "javascript:alert(1)",
])("回答先にできないURLを無効にする %s", (url) => {
  expect(tutorialSurveyUrl("?study=1", url)).toBeUndefined();
});
