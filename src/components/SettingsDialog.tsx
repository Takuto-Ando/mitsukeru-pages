import { useEffect, useRef, useState } from "react";
import { X, BookOpenText } from "lucide-react";
import { RecognitionPreparation } from "./RecognitionPreparation";
import { OfflineStatus } from "../offline/OfflineStatus";
import { SpeechSettings, stopSpeech } from "../speech/Speech";
import { StudyControls } from "./StudyControls";
import {
  automaticStudyShare,
  flushShareQueue,
  loadShareConfig,
  managedProductionShare,
  pendingShareCount,
  saveShareConfig,
} from "../future/share";
export function SettingsDialog({
  open,
  onClose,
  furigana,
  onFuriganaChange,
  returnFocus,
  product = false,
}: {
  returnFocus?: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  product?: boolean;
  furigana?: boolean;
  onFuriganaChange?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const wasOpen = useRef(false);
  const [share, setShare] = useState(loadShareConfig);
  const [pending, setPending] = useState(pendingShareCount);
  const [shareNote, setShareNote] = useState("");
  const refreshPending = () => setPending(pendingShareCount());
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) {
      wasOpen.current = true;
      stopSpeech();
      element?.showModal();
    } else if (!open && wasOpen.current) {
      wasOpen.current = false;
      if (element?.open) element.close();
      // Safari does not focus a button on pointer activation, so the native
      // dialog alone cannot always restore the originating control.
      if (returnFocus?.current?.isConnected)
        returnFocus.current.focus({ preventScroll: true });
    }
  }, [open, returnFocus]);
  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      aria-labelledby="settings-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="settings-heading">
        <h2 id="settings-title">設定</h2>
        <button type="button" onClick={onClose} aria-label="設定を閉じる">
          <X aria-hidden="true" size={22} />
        </button>
      </div>
      <div className="settings-content">
        {onFuriganaChange && (
          <div className="sound-setting">
            <span>
              <BookOpenText aria-hidden="true" size={19} />
              ふりがな
            </span>
            <button aria-pressed={!!furigana} onClick={onFuriganaChange}>
              ふりがな {furigana ? "ON" : "OFF"}
            </button>
          </div>
        )}
        {!product && <SpeechSettings />}
        {!automaticStudyShare && (
          <details className="dictionary-check">
            <summary>絵の自動送信（研究用）</summary>
            <div className="share-setting">
              <label className="share-consent">
                <input
                  type="checkbox"
                  checked={share.consent}
                  onChange={(event) => {
                    const next = { ...share, consent: event.target.checked };
                    setShare(next);
                    saveShareConfig(next);
                    if (next.consent)
                      void flushShareQueue().then(refreshPending);
                  }}
                />
                {managedProductionShare
                  ? "保存した絵を研究用に自動で送る"
                  : "保存した絵と気づきのメモを研究のために送ることに同意します（おうちの人と確認してからONにしてください）"}
              </label>
              {!product && !managedProductionShare && (
                <>
                  <label>
                    送信先URL（Apps Script）
                    <input
                      type="url"
                      value={share.endpoint}
                      placeholder="https://script.google.com/macros/s/…/exec"
                      onChange={(event) => {
                        const next = {
                          ...share,
                          endpoint: event.target.value.trim(),
                        };
                        setShare(next);
                        saveShareConfig(next);
                      }}
                    />
                  </label>
                  <label>
                    トークン
                    <input
                      type="password"
                      autoComplete="off"
                      value={share.token}
                      onChange={(event) => {
                        const next = {
                          ...share,
                          token: event.target.value.trim(),
                        };
                        setShare(next);
                        saveShareConfig(next);
                      }}
                    />
                  </label>
                </>
              )}
              <p className="profile-setting-note">
                未送信 {pending} 件。
                {managedProductionShare
                  ? "完成した絵（PNG）、線のデータ、動物と課題の名前、日時、端末内の記録IDを送ります。"
                  : "完成した絵（PNG）、線のデータ、動物と課題の名前、日時、気づきのメモ、端末内の記録IDを送ります。"}
                写真や声は送られません。
              </p>
              {!product && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void flushShareQueue().then((sent) => {
                        refreshPending();
                        setShareNote(
                          sent > 0
                            ? `${sent}件を送信しました。受け取りはDriveで確認できます。`
                            : "送れる絵はありませんでした（未送信が無いか、通信できませんでした）。",
                        );
                      });
                    }}
                  >
                    いま送信を試す
                  </button>
                  {shareNote && <p role="status">{shareNote}</p>}
                </>
              )}
            </div>
          </details>
        )}
        {!product && (
          <>
            <OfflineStatus />
            {open && <RecognitionPreparation />}
            <StudyControls />
          </>
        )}
      </div>
      <button className="settings-done" type="button" onClick={onClose}>
        体験に戻る
      </button>
    </dialog>
  );
}
