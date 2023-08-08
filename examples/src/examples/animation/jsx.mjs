import * as React from 'react';
import {
    BindingTwoWay, BooleanInput, Button, LabelGroup, SelectInput, SliderInput
} from '@playcanvas/pcui/react';
export const jsx = React.createElement;
export const fragment = (...args) => jsx(React.Fragment, null, ...args);

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
 * @param {object} options  - todo
 * @returns {JSX.Element}
 */
export function jsxButton(options) {
    return React.createElement(Button, options);
}

/**
 * @param {object} options - todo
 * @returns {JSX.Element} todo
 */
export function jsxBooleanInput(options) {
    return React.createElement(BooleanInput, options);
}

/**
 * @param {object} options  - todo
 * @returns {JSX.Element}
 */
export function jsxSelectInput(options) {
    return React.createElement(SelectInput, options);
}

/**
 * @param {object} options  - todo
 * @returns {JSX.Element}
 */
export function jsxSliderInput(options) {
    return React.createElement(SliderInput, options);
}


