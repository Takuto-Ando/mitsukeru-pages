import { cloneElement, createElement, isValidElement } from "react";
import { Furi } from "../Furigana";

const textElements = new Set(
  "a b blockquote button caption dd div dt em figcaption h1 h2 h3 h4 h5 h6 i label legend li output p section small span strong summary td th time".split(
    " ",
  ),
);
const formControls = new Set(["input", "textarea", "select"]);
const kanji = /[\p{Script=Han}々]/u;

export function annotateChildren<T>(type: unknown, props: T): T {
  if (
    typeof type !== "string" ||
    !textElements.has(type) ||
    !props ||
    typeof props !== "object" ||
    !("children" in props)
  ) {
    return props;
  }
  const annotate = (child: unknown, position?: number) =>
    typeof child === "string" && kanji.test(child)
      ? createElement(Furi, {
          text: child,
          label: type !== "label",
          key: position,
        })
      : child;
  const children = props.children;
  if (Array.isArray(children)) {
    const label =
      type === "label"
        ? children
            .filter((child) => typeof child === "string")
            .join("")
            .trim()
        : "";
    const annotated = children.map((child, position) => {
      if (
        kanji.test(label) &&
        isValidElement<{ "aria-label"?: string; "aria-labelledby"?: string }>(
          child,
        ) &&
        typeof child.type === "string" &&
        formControls.has(child.type) &&
        !child.props["aria-label"] &&
        !child.props["aria-labelledby"]
      ) {
        return cloneElement(child, { "aria-label": label });
      }
      return annotate(child, position);
    });
    return annotated.some((child, index) => child !== children[index])
      ? { ...props, children: annotated }
      : props;
  }
  const annotated = annotate(children);
  return annotated === children ? props : { ...props, children: annotated };
}
