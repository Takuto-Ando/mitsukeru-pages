export function tutorialSurveyUrl(
  search: string,
  responseUrl?: string,
): string | undefined {
  if (new URLSearchParams(search).get("study") !== "1" || !responseUrl?.trim())
    return;
  try {
    const url = new URL(responseUrl.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return;
    const shortLink =
      url.hostname === "forms.gle" &&
      /^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname);
    const responseLink =
      url.hostname === "docs.google.com" &&
      /^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[a-zA-Z0-9_-]+\/viewform\/?$/.test(
        url.pathname,
      );
    if (!shortLink && !responseLink) return;
    return url.origin + url.pathname;
  } catch {
    return undefined;
  }
}
