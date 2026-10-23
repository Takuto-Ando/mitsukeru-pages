import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Celebration } from "../Illustrations";
import { SketchComparison } from "../components/SketchComparison";
import type { ObservationGroup } from "../content/groups";
import type { Stroke } from "../types";

export function ResultScreen({
  strokes,
  answer,
  onNext,
}: {
  strokes: Stroke[];
  answer: ObservationGroup["answer"];
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className="result-page"
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Celebration />
      <span className="eyebrow">自分の目で、見つけたね。</span>
      <h1 tabIndex={-1}>
        大発見<span>！</span>
      </h1>
      <p className="discovery-title">
        ヤギの瞳は、<strong>横長！</strong>
      </p>
      <SketchComparison strokes={strokes} answer={answer} />
      <button className="primary" onClick={() => onNext()}>
        どうして横長なの？
        <ArrowRight size={20} />
      </button>
    </motion.section>
  );
}
