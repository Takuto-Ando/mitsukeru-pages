import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import { ReplicaApp } from "./replica/ReplicaApp";
import "./styles/tokens.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <ReplicaApp />
  </MotionConfig>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .register(import.meta.env.BASE_URL + "sw.js", {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    })
    .catch(() => {
      // The online prototype and its local gallery work if caching is unavailable.
    });
}
