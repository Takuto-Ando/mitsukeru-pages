import { downloadBlob } from "../notebook/download";

const extensions = { "image/jpeg": "jpg", "image/png": "png" } as const;

export async function saveCapturedPhoto(dataUrl: string, date: string) {
  const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!match) throw Error("Invalid saved photo");
  const type = match[1] as keyof typeof extensions;
  const bytes = Uint8Array.from(atob(match[2]), (character) =>
    character.charCodeAt(0),
  );
  const name = `zooketch-photo-${date.slice(0, 10)}.${extensions[type]}`;
  const file = new File([bytes], name, { type });

  // Sharing must begin in the user's tap handler on iPhone Safari.
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        return false;
    }
  }

  downloadBlob(file, name);
  return true;
}
