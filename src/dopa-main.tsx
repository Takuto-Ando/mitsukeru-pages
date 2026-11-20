import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./App";
import "./styles/tokens.css";
import "./styles/dopa.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <App dopa />
  </MotionConfig>,
);
