import { useEffect, useState } from "react";
import { getXp, levelForXp, xpForLevel } from "./dopa";

/** ドパガキモードの XP バー（レベル・進捗・次のレベルまでの残り） */
export function DopaBar() {
  const [xp, setXp] = useState(getXp);
  useEffect(() => {
    const handler = () => setXp(getXp());
    window.addEventListener("dopa:xp", handler);
    return () => window.removeEventListener("dopa:xp", handler);
  }, []);
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const ratio = Math.min(1, Math.max(0, (xp - floor) / (ceil - floor)));
  return (
    <div className="dopa-bar" role="status" aria-label={`レベル${level}、経験値${xp}`}>
      <span className="dopa-bar-level">Lv.{level}</span>
      <span className="dopa-bar-track" aria-hidden="true">
        <span className="dopa-bar-fill" style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="dopa-bar-text">
        {xp} XP ・ あと {ceil - xp} XP でレベルアップ！
      </span>
    </div>
  );
}
