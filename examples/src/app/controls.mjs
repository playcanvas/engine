import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { useParams } from 'react-router-dom';
import { jsx, fragment, jsxBooleanInput, jsxSelectInput, jsxSliderInput, jsxButton  } from './jsx.mjs';
import { exampleData } from '../example-data.mjs';
import ControlPanel from './control-panel.mjs';
import { BindingTwoWay, Label, LabelGroup, SliderInput, Button, BooleanInput, SelectInput, Panel } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';
import React, { createRef, Component, useEffect } from 'react';

// What the UI "controls" function needs. We are mixing React and PlayCanvas code in the examples and:
// 1) We don't want to load React code in iframe
// 2) We don't want to load PlayCanvas code in Examples browser
// (just to keep the file sizes as minimal as possible)
Object.assign(window, {
    BindingTwoWay, Label, LabelGroup, SliderInput, Button, BooleanInput, SelectInput, Panel,
    Observer,
    jsx, fragment, jsxBooleanInput, jsxSelectInput, jsxSliderInput, jsxButton,
    React, createRef, Component, useEffect,
});

/**
 * @example
 * makeCamelCase('animation') // Outputs 'Animation'
 * makeCamelCase('user-interface'); // Outputs 'UserInterface'
 * @param {string} word - The word.
 */
const makeCamelCase = word => (
    word.charAt(0).toUpperCase() + word.slice(1)
).replace(/-(.)/g, function(match, p1){
    return p1.toUpperCase();
});

/**
 * @example
 * console.log(rewriteExampleString('blend-trees-2d-cartesian')); // Outputs "BlendTrees2DCartesianExample"
 * @param {*} str 
 * @returns 
 */
function rewriteExampleString(str) {
    let result = str.split('-').map(makeCamelCase).join('');
    result = result.replaceAll("1d", "1D");
    result = result.replaceAll("2d", "2D");
    result = result.replaceAll("3d", "3D");
    result += "Example";
    return result;
}

/**
 * @typedef {object} ControlsProps
 * @property {object[]} files
 */

/**
 * @param {ControlsProps} props - The props.
 * @returns {JSX.Element}
 */
function Controls(props) {
    let { category, example } = useParams();
    //category = makeCamelCase(category);
    //example = rewriteExampleString(example);  
    let controls;
    let controlsSrc = exampleData[category][example].controls;
    if (controlsSrc) {
        if (!controlsSrc.startsWith('function') && !controlsSrc.startsWith('class')) {
            controlsSrc = 'function ' + controlsSrc;
        }
        controls = Function('return ' + controlsSrc)();
    }
    // This was fragile and hard to follow...
    // controls = (document.getElementsByTagName('iframe')[0]).contentWindow.Example?.controls || null;
    // on desktop dont show the control panel when no controls are present
    if (!controls && window.top.innerWidth >= MIN_DESKTOP_WIDTH) {
        return null;
    }
    return jsx(
        ControlPanel,
        {
            controls,
            files: props.files
        }
    );
};
export { Controls };
