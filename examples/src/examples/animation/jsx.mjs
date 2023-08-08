import * as React from 'react';
import { BindingTwoWay, BooleanInput, Button, LabelGroup } from '@playcanvas/pcui/react';
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
/**
 * @param {object} options 
 * @returns {JSX.Element}
 */
export function jsxButton(options) {
    return React.createElement(Button, options);
}
/**
 * @param {object} options 
 * @returns {JSX.Element}
 */
export function jsxBooleanInput(options) {
    return React.createElement(BooleanInput, options);
}
