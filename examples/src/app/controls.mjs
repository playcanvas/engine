import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { jsx, fragment, jsxBooleanInput, jsxSelectInput, jsxSliderInput, jsxButton  } from './jsx.mjs';
import ControlPanel from './control-panel.mjs';
import { BindingTwoWay, Label, LabelGroup, SliderInput, Button, BooleanInput, SelectInput, Panel } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';
import React, { useRef, createRef, Component, useEffect } from 'react';

// What the UI "controls" function needs. We are mixing React and PlayCanvas code in the examples and:
// 1) We don't want to load React code in iframe
// 2) We don't want to load PlayCanvas code in Examples browser
// (just to keep the file sizes as minimal as possible)
Object.assign(window, {
    BindingTwoWay, Label, LabelGroup, SliderInput, Button, BooleanInput, SelectInput, Panel,
    Observer,
    jsx, fragment, jsxBooleanInput, jsxSelectInput, jsxSliderInput, jsxButton,
    React, useRef, createRef, Component, useEffect,
});

/**
 * @typedef {object} ControlsProps
 * @property {Record<string, string>} files
 */

/**
 * @param {ControlsProps} props - The props.
 * @returns {JSX.Element}
 */
function Controls(props) {
    //console.log('RERENDER CONTROLS> props.files', props.files);
    //const controlsSrc = props.files['controls.mjs'] ?? 'null';
    //const controls = Function('return ' + controlsSrc)();
    //console.log('controlsSrc', controlsSrc.slice(0, 32));
    // on desktop dont show the control panel when no controls are present
    if (!props.controls && window.top.innerWidth >= MIN_DESKTOP_WIDTH) {
        return null;
    }
    return jsx(
        ControlPanel,
        {
            controls: props.controls,
        },
        jsx('h1', null, 'control panel children')
    );
};
export { Controls };
