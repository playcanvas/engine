
import * as React from "react";
import { jsx, jsxContainer, jsxPanel, jsxSelectInput, jsxSpinner } from './jsx.mjs';
import { MIN_DESKTOP_WIDTH } from '../../../src/app/constants.mjs';
import { DeviceSelector } from "../../app/device-selector.mjs";

class ExampleUI extends React.Component {
    /**
     * @param {string} value - todo
     */
    onSetPreferredGraphicsDevice(value) {
        console.log("todo save state as # and reload");
    }
    render() {
        // TODO yet another component to separate this code (same code in src/app/example.mjs)
        return jsxPanel(
            {
                id: 'controlPanel',
                class: [window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'mobile' : null],
                resizable: 'top',
                headerText: window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'CODE & CONTROLS' : 'CONTROLS',
                collapsible: true,
                collapsed: window.top.innerWidth < MIN_DESKTOP_WIDTH
            },
            jsx(DeviceSelector, {onSelect: this.onSetPreferredGraphicsDevice}),
            this.props.children,
        );
    }
}

export {
    ExampleUI
};
