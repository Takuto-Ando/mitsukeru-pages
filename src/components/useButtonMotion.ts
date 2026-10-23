import { useEffect } from "react";
import { animate, useReducedMotion } from "motion/react";
export function useButtonMotion() {
  const reduce = useReducedMotion();
  useEffect(() => {
    let active: HTMLButtonElement | undefined;
    const release = () => {
      if (active) {
        animate(
          active,
          { scale: 1 },
          { type: "spring", stiffness: 400, damping: 20 },
        );
        active = undefined;
      }
    };
    const press = (event: Event) => {
      if (reduce) return;
      const target =
        event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement) || target.disabled) return;
      release();
      active = target;
      animate(target, { scale: 0.94 }, { duration: 0.08 });
    };
    const keydown = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) press(e);
    };
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", release);
    return () => {
      release();
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", release);
    };
  }, [reduce]);
}
