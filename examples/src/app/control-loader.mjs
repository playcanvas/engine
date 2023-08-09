import React, { Component } from 'react';
import { fragment, jsx } from "../examples/animation/jsx.mjs";
import { controlsObserver } from './example.mjs';
import { Controls } from './controls.mjs';
/**
 * @typedef {object} ControlLoaderProps
 * @property {string} path
 * @property {any} files
 */
/**
 * @typedef {object} ControlLoaderState
 * @property {boolean} exampleLoaded
 */
/**
 * @extends Component <ControlLoaderProps, ControlLoaderState>
 */
class ControlLoader extends Component {
    //timeout;
    /**
     * @param {ControlLoaderProps} props 
     */
    constructor(props) {
        super(props);
        this.state = {
            exampleLoaded: false
        };
        window.addEventListener('exampleLoading', () => {
            this.setState({
                exampleLoaded: false
            });
        });
        window.addEventListener('exampleLoad', (event) => {
            this.setState({
                exampleLoaded: true
            });
            //debugger;
            const activeDevice = event.deviceType;
            console.log("got device type from iframe:", activeDevice);
            controlsObserver.emit('updateActiveDevice', activeDevice);
        });
        console.log("another control loader...", this);
    }
    /**
     * @param {Readonly<ControlLoaderProps>} prevProps 
     * @returns {void}
     */
    componentDidUpdate(prevProps) {
        if (prevProps.path !== this.props.path) {
            this.setState({
                exampleLoaded: false
            });
        }
    }
    render() {
        return fragment(
            this.state.exampleLoaded && jsx(
                Controls,
                {
                    ...this.props
                }
            )
        );
    }
}
export {
    ControlLoader,
};
