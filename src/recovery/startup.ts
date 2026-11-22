export const recoveryMessage = "画面を開けませんでした。";
export const retryLabel = "もう一度試す";

let retrying = false;

export async function retryApplication() {
  if (retrying) return;
  retrying = true;
  const abort = new AbortController();
  const timeout = window.setTimeout(() => abort.abort(), 3000);
  try {
    // WebKit can retain a failed module preload across a normal page reload.
    const resources = Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel="modulepreload"], link[rel="stylesheet"]',
      ),
      (link) => new URL(link.href),
    ).filter((url) => url.origin === window.location.origin);
    await Promise.allSettled(
      resources.map(async (url) => {
        const response = await fetch(url, {
          cache: "reload",
          signal: abort.signal,
        });
        if (response.ok) await response.arrayBuffer();
      }),
    );
  } finally {
    window.clearTimeout(timeout);
    window.location.reload();
  }
}

export function showStartupError() {
  const root = document.getElementById("root");
  if (!root) return;
  const alert = document.createElement("p");
  alert.setAttribute("role", "alert");
  alert.textContent = recoveryMessage;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = retryLabel;
  retry.addEventListener("click", () => void retryApplication());
  const main = document.createElement("main");
  main.append(alert, retry);
  root.replaceChildren(main);
}
