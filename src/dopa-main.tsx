import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./App";
import { loadLicensedTypography } from "./typography";
import "./styles/tokens.css";

loadLicensedTypography(import.meta.env.VITE_ADOBE_FONTS_KIT_ID);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <App dopa />
  </MotionConfig>,
);
