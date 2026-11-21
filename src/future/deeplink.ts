// QRコード／リンクから課題へ直行するためのハッシュリンク。
export function taskHash(taskId: string): string {
  return `#task=${encodeURIComponent(taskId)}`;
}

export function parseTaskHash(hash: string): string | null {
  const match = /^#task=(.+)$/.exec(hash);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function taskUrl(taskId: string): string {
  return `${location.origin}${location.pathname}${taskHash(taskId)}`;
}
