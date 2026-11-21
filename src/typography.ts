type AdobeFonts = {
  load(options: {
    kitId: string;
    scriptTimeout: number;
    async: boolean;
    fontactive: (family: string, variation: string) => void;
  }): void;
};

export function loadLicensedTypography(projectId: string | undefined) {
  const kitId = projectId?.trim();
  if (!kitId || !/^[a-z0-9]{7}$/.test(kitId)) return;

  // Adobe's JavaScript embed enables dynamic subsetting for Japanese fonts.
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://use.typekit.net/${kitId}.js`;
  script.addEventListener("load", () => {
    const adobe = (window as Window & { Typekit?: AdobeFonts }).Typekit;
    adobe?.load({
      kitId,
      scriptTimeout: 3000,
      async: true,
      fontactive: (family, variation) => {
        if (family === "dnp-shuei-mgothic-std" && variation === "n6")
          document.documentElement.dataset.uiFont = "dnp";
      },
    });
  });
  document.head.append(script);
}
