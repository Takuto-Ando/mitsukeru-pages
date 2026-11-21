if (import.meta.env.VITE_LEGACY_EDITIONS === "1") {
  void import("./legacy-main");
} else {
  void import("./replica-main");
}
