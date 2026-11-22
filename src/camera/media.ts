export type CameraFailure =
  "permission" | "unavailable" | "busy" | "insecure" | "unknown";

export function cameraFailure(error: unknown): CameraFailure {
  if (!(error instanceof DOMException)) return "unknown";
  switch (error.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "permission";
    case "SecurityError":
      return "insecure";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "unavailable";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    default:
      return "unknown";
  }
}

export async function openPreferredCamera(
  devices: MediaDevices,
  stillNeeded: () => boolean,
) {
  const modestDevice = navigator.hardwareConcurrency <= 4;
  try {
    return await devices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: modestDevice ? 960 : 1280, max: 1920 },
        height: { ideal: modestDevice ? 720 : 960, max: 1920 },
      },
      audio: false,
    });
  } catch (error) {
    // Some devices cannot satisfy a specific facing mode or resolution.
    // A second request without constraints also covers front-only devices.
    if (cameraFailure(error) !== "unavailable" || !stillNeeded()) throw error;
    return devices.getUserMedia({ video: true, audio: false });
  }
}
