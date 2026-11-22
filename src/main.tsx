import { showStartupError } from "./recovery/startup";

if (import.meta.env.VITE_LEGACY_EDITIONS === "1") {
  void import("./legacy-main").catch(showStartupError);
} else {
  void import("./replica-main").catch(showStartupError);
}
