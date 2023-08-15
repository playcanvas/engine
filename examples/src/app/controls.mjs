import React, { Component } from 'react';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { useParams } from 'react-router-dom';
import { jsx } from './jsx.mjs';
import * as realExamples from "../examples/index.mjs";
window.realExamples = realExamples; // iframe requires this
import ControlPanel from './control-panel.mjs';
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
    category = makeCamelCase(category);
    example = rewriteExampleString(example);
    let controls;
    try {
        //debugger;
        controls = realExamples[category][example].controls;
        //console.log({controls});
    } catch (e) {
        console.warn("error finding jsx controls for example", e);
    }
    //const controlsFunction = JsxControls; // only for test
    //const controlsFunction = (document.getElementsByTagName('iframe')[0] /*as any*/).contentWindow.Example.controls || null;
    //console.log("CONTROLS FUNCTION", controlsFunction)
    // on desktop dont show the control panel when no controls are present
    if (!controls && window.top.innerWidth >= MIN_DESKTOP_WIDTH) {
        return null;
    }
    //return <ControlPanel controls={controlsFunction} files={props.files} />;
    return jsx(
        ControlPanel,
        {
            controls,
            files: props.files
        }
    );
};
export {
    Controls,
};
