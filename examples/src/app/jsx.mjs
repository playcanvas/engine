import * as React from 'react';
export const jsx = React.createElement;
export const fragment = (...args) => jsx(React.Fragment, null, ...args);
import { createRoot } from "react-dom/client";

/**
 * @param {Function} fn - todo
 */
export function jsxTry(fn) {
    return (...args) => {
        try {
           fn(...args);
        } catch (e) {
            console.error("jsxTry failed>", e);
            return jsx("pre", null, e);
        }
    }
}

/**
 * @param {JSX.Element} jsx - todo
 */
export function appendReactToBody(jsx) {
    const div = document.createElement("div");
    const root = createRoot(div);
    root.render(jsx);
    document.body.append(div);
}
