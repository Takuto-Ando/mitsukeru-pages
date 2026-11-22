// CSS handles animations created while the page is hidden. Explicitly pause
// running Web Animations as well, including animations started by Motion.
export function pauseHiddenAnimations() {
  const paused = new Set<Animation>();
  function pause() {
    document.documentElement.dataset.zooketchHidden = "";
    for (const animation of document.getAnimations?.() ?? []) {
      if (
        animation.playState === "running" &&
        !("animationName" in animation)
      ) {
        animation.pause();
        paused.add(animation);
      }
    }
  }
  function resume() {
    if (document.hidden) return;
    delete document.documentElement.dataset.zooketchHidden;
    for (const animation of paused) {
      if (animation.playState === "paused") animation.play();
    }
    paused.clear();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else resume();
  });
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", resume);
  if (document.hidden) pause();
}
