import { useEffect, useState } from "react";
export function OfflineStatus() {
  const [message, setMessage] = useState("オフライン準備を確認中…");
  const [waiting, setWaiting] = useState<ServiceWorker>();
  useEffect(() => {
    if (!import.meta.env.PROD) {
      setMessage("オフライン準備は公開版で利用できます。");
      return;
    }
    if (!/^https?:$/.test(location.protocol)) {
      setMessage("アプリに観察素材を同梱しています。");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      setMessage("このブラウザではオフライン準備を利用できません。");
      return;
    }
    let alive = true;
    const cleanups = new Set<() => void>();
    let closeStatus: (() => void) | undefined;
    const check = () => {
      if (!alive) return;
      closeStatus?.();
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      const close = () => {
        clearTimeout(timeout);
        channel.port1.onmessage = null;
        channel.port1.close();
        channel.port2.close();
      };
      const timeout = window.setTimeout(() => {
        close();
        if (alive)
          setMessage(
            "準備状況を確認できませんでした。オンラインで開き直してください。",
          );
      }, 10000);
      closeStatus = close;
      channel.port1.onmessage = (e) => {
        close();
        if (alive)
          setMessage(
            e.data?.ready
              ? "オフライン準備完了（観察・ノート）"
              : "素材の準備が未完了です。オンラインで開き直してください。",
          );
      };
      try {
        worker.postMessage("offline-status", [channel.port2]);
      } catch {
        close();
        if (alive) setMessage("オフライン準備を確認できませんでした。");
      }
    };
    void navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js", {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((reg) => {
        if (!alive) return;
        if (reg.waiting) setWaiting(reg.waiting);
        const update = () => {
          const installing = reg.installing;
          const changed = () => {
            if (alive && installing?.state === "installed" && reg.waiting)
              setWaiting(reg.waiting);
          };
          installing?.addEventListener("statechange", changed);
          cleanups.add(() =>
            installing?.removeEventListener("statechange", changed),
          );
        };
        reg.addEventListener("updatefound", update);
        cleanups.add(() => reg.removeEventListener("updatefound", update));
        check();
        void navigator.serviceWorker.ready.then(check);
      })
      .catch(() => {
        if (alive)
          setMessage(
            "オフライン準備ができませんでした。通信と空き容量を確認してください。",
          );
      });
    navigator.serviceWorker.addEventListener("controllerchange", check);
    return () => {
      alive = false;
      closeStatus?.();
      cleanups.forEach((cleanup) => cleanup());
      navigator.serviceWorker.removeEventListener("controllerchange", check);
    };
  }, []);
  return (
    <details className="offline-status">
      <summary>通信・オフライン</summary>
      <p role="status">{message}</p>
      <p className="quiet-note">
        初回はオンラインで準備してください。端末の空き容量やブラウザの操作で保存素材が消えることがあります。AIモデルと読み上げ音声は別の準備が必要です。
      </p>
      {waiting && (
        <button
          onClick={() => {
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => location.reload(),
              { once: true },
            );
            waiting.postMessage("activate-update");
          }}
        >
          最新版を開く（描画中の内容は消えます）
        </button>
      )}
    </details>
  );
}
