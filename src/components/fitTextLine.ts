export function fitTextLine(text: HTMLElement, available: number) {
  text.style.letterSpacing = "";
  text.style.transform = "";
  text.style.fontSize = "";

  if (!available || text.getBoundingClientRect().width <= available) return;

  text.style.letterSpacing = "-0.045em";
  const required = text.getBoundingClientRect().width;
  if (required <= available) return;

  const scale = Math.max(0.82, available / required);
  text.style.transform = `scaleX(${scale})`;
  if (required * scale > available)
    text.style.fontSize = `${(available - 0.5) / (required * scale)}em`;
}
