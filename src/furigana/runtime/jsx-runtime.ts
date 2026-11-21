import { jsx as reactJsx, jsxs as reactJsxs } from "react/jsx-runtime";
import { annotateChildren } from "./children";

export { Fragment, type JSX } from "react/jsx-runtime";

export const jsx: typeof reactJsx = (type, props, key) =>
  reactJsx(type, annotateChildren(type, props), key);
export const jsxs: typeof reactJsxs = (type, props, key) =>
  reactJsxs(type, annotateChildren(type, props), key);
