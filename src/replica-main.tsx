import ReactDOM from "react-dom/client";
import { ReplicaApp } from "./replica/ReplicaApp";
import { loadLicensedTypography } from "./typography";
import { pauseHiddenAnimations } from "./replica/visibility";
import "./styles/tokens.css";
import "./replica/visibility.css";

loadLicensedTypography(import.meta.env.VITE_ADOBE_FONTS_KIT_ID);
pauseHiddenAnimations();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ReplicaApp legacy={import.meta.env.VITE_LEGACY_EDITIONS === "1"} />,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  function registerWhenVisible() {
    if (document.hidden) {
      document.addEventListener("visibilitychange", registerWhenVisible, {
        once: true,
      });
      return;
    }
    void navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js", {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .catch(() => {
        // A failed install does not prevent online use or local gallery access.
      });
  }
  const afterLoad = () => window.setTimeout(registerWhenVisible, 1200);
  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });
}
