import { Capacitor, registerPlugin } from "@capacitor/core";

const pluginName = "CameraPermissionSettings";
const nativeSettings = registerPlugin<{
  open(): Promise<{ opened: boolean }>;
}>(pluginName);

export const cameraSettingsReturnedEvent = "zooketch:camera-settings-returned";

export function cameraPermissionSettings() {
  if (Capacitor.getPlatform() === "ios") {
    return {
      canOpen: Capacitor.isPluginAvailable(pluginName),
      instructions:
        "端末の「設定」から「ズーケッチ」を開き、「カメラ」をオンにしてね。",
    };
  }

  const { userAgent, platform, maxTouchPoints } = navigator;
  if (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  ) {
    const inSafari =
      !/CriOS|FxiOS|EdgiOS|DuckDuckGo/i.test(userAgent) &&
      !window.matchMedia("(display-mode: standalone)").matches;
    return {
      canOpen: false,
      instructions: inSafari
        ? "Safariのアドレス欄にあるページメニューから「Webサイトの設定」を開き、「カメラ」を「許可」にしてね。"
        : "Safariでこのページを開いて、ページメニューから「Webサイトの設定」→「カメラ」を「許可」にしてね。",
    };
  }
  if (/Android/i.test(userAgent)) {
    return {
      canOpen: false,
      instructions:
        "アドレス欄のサイト情報から「権限」→「カメラ」を許可してね。端末でオフの場合は、設定の「アプリ」からブラウザのカメラ権限も確認してね。",
    };
  }
  return {
    canOpen: false,
    instructions:
      "アドレス欄のサイト情報またはブラウザの設定から、このサイトのカメラを許可してね。",
  };
}

export async function openCameraPermissionSettings() {
  if (!cameraPermissionSettings().canOpen) return false;
  try {
    return (await nativeSettings.open()).opened;
  } catch {
    return false;
  }
}
