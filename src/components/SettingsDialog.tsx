import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { X, Volume2, BookOpenText } from "lucide-react";
import { OfflineStatus } from "../offline/OfflineStatus";
import { SpeechSettings, stopSpeech } from "../speech/Speech";
import { StudyControls } from "./StudyControls";
import { groups } from "../content/groups";
import { tasks } from "../content/tasks";
import { uncoveredWords } from "../furigana/coverage";
import {
  addProfile,
  currentProfileId,
  loadProfiles,
  setCurrentProfile,
} from "../future/profiles";
import "../styles/observation-tools.css";

const ExtraObservationTools = lazy(() => import("./ExtraObservationTools"));

export function SettingsDialog({
  open,
  onClose,
  sound,
  onSoundChange,
  furigana,
  onFuriganaChange,
  returnFocus,
  defaultObservationTaskId,
}: {
  returnFocus?: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  sound: boolean;
  onSoundChange: () => void;
  furigana?: boolean;
  onFuriganaChange?: () => void;
  defaultObservationTaskId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const wasOpen = useRef(false);
  const [toolsLoaded, setToolsLoaded] = useState(false);
  const [profiles, setProfiles] = useState(loadProfiles);
  const [currentId, setCurrentId] = useState(currentProfileId);
  const [newName, setNewName] = useState("");
  const missingWords = useMemo(
    () =>
      uncoveredWords([
        ...groups.flatMap((g) => [g.fact, g.question]),
        ...tasks.flatMap((t) => [t.explanation.form, t.explanation.ecology]),
      ]),
    [],
  );
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
        <SpeechSettings />
        <div className="profile-setting">
          <p className="profile-setting-title">
            きょうだいプロフィール（今の記録先）
          </p>
          <div className="profile-setting-list">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={currentId === p.id}
                className={currentId === p.id ? "is-active" : ""}
                onClick={() => {
                  setCurrentProfile(p.id);
                  setCurrentId(p.id);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="profile-setting-add">
            <input
              type="text"
              value={newName}
              maxLength={10}
              placeholder="新しい名前（例：あおい）"
              aria-label="新しいプロフィールの名前"
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="button"
              disabled={!newName.trim()}
              onClick={() => {
                addProfile(newName);
                setProfiles(loadProfiles());
                setCurrentId(currentProfileId());
                setNewName("");
              }}
            >
              追加する
            </button>
          </div>
          <p className="profile-setting-note">
            観察カードは選んだプロフィールで保存され、マイギャラリーで
            絞り込めます。
          </p>
        </div>
        <details className="dictionary-check">
          <summary>
            ふりがな辞書チェック（未登録 {missingWords.length} 件）
          </summary>
          {missingWords.length === 0 ? (
            <p>いまの文章はすべて辞書でカバーできています。</p>
          ) : (
            <p>{missingWords.join("、")}</p>
          )}
        </details>
        <OfflineStatus />
        <details
          className="observation-tools-settings"
          onToggle={(event) => {
            if (event.currentTarget.open) setToolsLoaded(true);
          }}
        >
          <summary>追加の観察ツール</summary>
          {toolsLoaded && (
            <Suspense fallback={<p role="status">ツールを読み込み中…</p>}>
              <ExtraObservationTools defaultTaskId={defaultObservationTaskId} />
            </Suspense>
          )}
        </details>
        <StudyControls />
      </div>
      <button className="settings-done" type="button" onClick={onClose}>
        体験に戻る
      </button>
    </dialog>
  );
}
