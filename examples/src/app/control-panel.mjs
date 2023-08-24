import { Component } from 'react';
/**
 * @typedef {import('react').FunctionComponent<{observer: import('@playcanvas/observer').Observer}>} ExampleControls
 */

/**
 * @typedef {object} Props
 * @property {ExampleControls} controls - The controls
 */

/**
 * @typedef {object} State
 * @property {boolean} collapsed - todo
 */

/**
 * @typedef {typeof Component<Props, State>}
 */
const TypedComponent = Component;

class ControlPanel extends TypedComponent {
    /**
     * @param {Props} props - The props.
     */
    constructor(props) {
        super(props);
        //effectUpdate();
        //function effectUpdate() {
        //    console.log("ControlPanel effectUpdate(), window.top.innerWidth < MIN_DESKTOP_WIDTH == ", window.top.innerWidth < MIN_DESKTOP_WIDTH);
        //    if (window.top.innerWidth < MIN_DESKTOP_WIDTH) {
        //        // @ts-ignore
        //        document.getElementById('controlPanel-controls').ui.hidden = true;
        //        document.getElementById('controlPanel').ui.hidden = false;
        //    }
        //    if (window.top.location.hash.indexOf('#/iframe') === 0) {
        //        // @ts-ignore
        //        document.getElementById('controlPanel').ui.hidden = true;
        //        document.getElementById('controlPanel-controls').ui.hidden = false;
        //    }
        //}
    }
}

export default ControlPanel;
