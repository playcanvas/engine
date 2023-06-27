import * as React from 'react';
import { ScriptLoader } from '../../app/helpers/loader.mjs';
export const jsx = React.createElement;
export const fragment = (...args) => jsx(React.Fragment, null, ...args);
/**
 * @param {string} name 
 * @param {string} url 
 * @returns {JSX.Element}
 */
export function scriptLoader(name, url) {
    return jsx(ScriptLoader, { name, url});
}
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
