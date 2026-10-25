// data:/blob: are local images and must stay readable without a network.
export function remoteWhileOffline(
  input: string,
  origin: string,
  online: boolean,
) {
  const url = new URL(input, origin);
  return !online && /^https?:$/.test(url.protocol) && url.origin !== origin;
}
