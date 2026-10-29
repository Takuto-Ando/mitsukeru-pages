import { useEffect, useRef } from "react";
import { X, Volume2 } from "lucide-react";
import { OfflineStatus } from "../offline/OfflineStatus";
import { SpeechSettings, stopSpeech } from "../speech/Speech";
import { StudyControls } from "./StudyControls";

export function SettingsDialog({
  open,
  onClose,
  sound,
  onSoundChange,
  returnFocus,
}: {
  returnFocus?: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  sound: boolean;
  onSoundChange: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const wasOpen = useRef(false);
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
        <div className="sound-setting">
          <span>
            <Volume2 aria-hidden="true" size={19} />
            効果音
          </span>
          <button aria-pressed={sound} onClick={onSoundChange}>
            効果音 {sound ? "ON" : "OFF"}
          </button>
        </div>
        <SpeechSettings />
        <OfflineStatus />
        <StudyControls />
      </div>
      <button className="settings-done" type="button" onClick={onClose}>
        体験に戻る
      </button>
    </dialog>
  );
}
