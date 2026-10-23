import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
export function Mascot({ step }: { step: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLObjectElement>(null);
  const frame = ["2-2", "2-26", "2-48", "2-74"][step];
  useEffect(() => {
    const follow = (event: PointerEvent) => {
      if (step !== 1 || !(event.target instanceof HTMLCanvasElement)) return;
      const bounds = event.target.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 4;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 4;
      ref.current?.contentDocument
        ?.querySelectorAll<SVGElement>('[id^="eye pupil"]')
        .forEach((p) => (p.style.translate = `${x}px ${y}px`));
    };
    window.addEventListener("pointermove", follow, { passive: true });
    return () => window.removeEventListener("pointermove", follow);
  }, [step]);
  return (
    <motion.div
      className="figma-mascot"
      key={step}
      animate={
        reduce
          ? {}
          : step === 2
            ? { y: [0, -10, 0] }
            : { rotate: [0, 3, -3, 0] }
      }
      transition={
        step === 2 ? { duration: 0.6 } : { duration: 7, repeat: Infinity }
      }
    >
      <object
        ref={ref}
        type="image/svg+xml"
        data={
          import.meta.env.BASE_URL +
          `figma/${frame}-imgMascotCuriousLittleEyeCreature.svg`
        }
        aria-label="目の大きなマスコット"
        role="img"
        onLoad={() => {
          const doc = ref.current?.contentDocument;
          if (!doc || reduce) return;
          const style = doc.createElementNS(
            "http://www.w3.org/2000/svg",
            "style",
          );
          style.textContent =
            '[id^="blinkable eye"],[id^="eye pupil"]{transform-box:fill-box;transform-origin:center;animation:blink 6s infinite}@keyframes blink{0%,44%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.08)}}';
          doc.documentElement.append(style);
        }}
      />
    </motion.div>
  );
}
