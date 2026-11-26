type AdobeFonts = {
  load(options: {
    kitId: string;
    scriptTimeout: number;
    async: boolean;
    fontactive: (family: string, variation: string) => void;
    fontinactive: (family: string, variation: string) => void;
    inactive: () => void;
  }): void;
};

export function loadLicensedTypography(projectId: string | undefined) {
  const kitId = projectId?.trim();
  const root = document.documentElement;
  if (!kitId || !/^[a-z0-9]{7}$/.test(kitId) || root.dataset.uiFont) return;

  const timeout = 3000;
  const isLicensedFace = (family: string, variation: string) =>
    family === "dnp-shuei-mgothic-std" && variation === "n6";
  function finish(state: "dnp" | "fallback") {
    if (root.dataset.uiFont !== "loading") return;
    window.clearTimeout(deadline);
    root.dataset.uiFont = state;
  }

  root.dataset.uiFont = "loading";
  const deadline = window.setTimeout(() => finish("fallback"), timeout);

  // Adobe's JavaScript embed enables dynamic subsetting for Japanese fonts.
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://use.typekit.net/${kitId}.js`;
  script.addEventListener("load", () => {
    if (root.dataset.uiFont !== "loading") return;
    const adobe = (window as Window & { Typekit?: AdobeFonts }).Typekit;
    if (!adobe) return finish("fallback");
    try {
      adobe.load({
        kitId,
        scriptTimeout: timeout,
        async: true,
        fontactive: (family, variation) => {
          if (isLicensedFace(family, variation)) finish("dnp");
        },
        fontinactive: (family, variation) => {
          if (isLicensedFace(family, variation)) finish("fallback");
        },
        inactive: () => finish("fallback"),
      });
    } catch {
      finish("fallback");
    }
  });
  script.addEventListener("error", () => finish("fallback"), { once: true });
  document.head.append(script);
}
