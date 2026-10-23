import { test, expect } from "vitest";
import { speciesRecognizer } from "../../src/recognition/species";
import { individualRecognizer } from "../../src/recognition/individual";
test("モデル未導入なら動物を推測して返さない", async () => {
  expect((await speciesRecognizer.recognize("test-photo")).status).toBe(
    "unsupported",
  );
  expect(
    (await individualRecognizer.identify("test-photo", "goat")).status,
  ).toBe("unsupported");
});
