import type { useCameraZoom } from "../camera/zoom";

export function CameraZoom({
  zoom,
  wide,
  busy,
  changeZoom,
}: ReturnType<typeof useCameraZoom>) {
  return (
    <div className="design3-zoom" role="group" aria-label="カメラのズーム">
      {([0.5, 1, 2] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`${value}×`}
          aria-pressed={zoom === value}
          disabled={busy || (value === 0.5 && !wide)}
          title={
            value === 0.5 && !wide
              ? "このカメラは0.5×に対応していません"
              : undefined
          }
          onClick={() => void changeZoom(value)}
        >
          {value === 2 ? (
            <span aria-hidden="true" className="zoom-text">
              2
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={
                value === 0.5
                  ? "zoom-mark zoom-mark--half"
                  : "zoom-mark zoom-mark--one"
              }
            />
          )}
        </button>
      ))}
    </div>
  );
}

export function CameraShutter({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="shutter-button"
      type="button"
      aria-label="シャッター"
      disabled={disabled}
      onClick={onClick}
    >
      <svg className="shutter-art" viewBox="0 0 77 77" aria-hidden="true">
        <circle className="shutter-center" cx="38.5" cy="38.5" r="31.72" />
        <circle
          cx="38.5"
          cy="38.5"
          r="36.45"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.79"
        />
      </svg>
    </button>
  );
}
