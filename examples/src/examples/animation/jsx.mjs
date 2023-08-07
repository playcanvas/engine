import * as React from 'react';
export const jsx = React.createElement;
export const fragment = (...args) => jsx(React.Fragment, null, ...args);
/**
 * @param {Function} fn
 */
export function jsxTry(fn) {
    return (...args) => {
        try {
           fn(...args);
        } catch (e) {
            return jsx("pre", null, e);
            console.error(e);
        }
    }
}
