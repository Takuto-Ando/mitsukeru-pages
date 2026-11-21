import { jsxDEV as reactJsxDEV } from "react/jsx-dev-runtime";
import { annotateChildren } from "./children";

export { Fragment, type JSX } from "react/jsx-dev-runtime";

export const jsxDEV: typeof reactJsxDEV = (type, props, ...rest) =>
  reactJsxDEV(type, annotateChildren(type, props), ...rest);
