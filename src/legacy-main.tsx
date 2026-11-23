import { AssetPreview } from "./components/AssetPreview";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import { MotionConfig } from "motion/react";
import { loadLicensedTypography } from "./typography";

loadLicensedTypography(import.meta.env.VITE_ADOBE_FONTS_KIT_ID);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    {import.meta.env.DEV &&
    new URLSearchParams(location.search).has("assets") ? (
      <AssetPreview />
    ) : (
      <App />
    )}
  </MotionConfig>,
);
