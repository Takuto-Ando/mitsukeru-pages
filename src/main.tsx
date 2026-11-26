import { showStartupError } from "./recovery/startup";
import { loadLicensedTypography } from "./typography";

if (import.meta.env.VITE_LEGACY_EDITIONS === "1") {
  void import("./legacy-main").catch(showStartupError);
} else {
  loadLicensedTypography(import.meta.env.VITE_ADOBE_FONTS_KIT_ID);
  void import("./replica-main").catch(showStartupError);
}
