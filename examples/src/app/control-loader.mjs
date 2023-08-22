import { Component } from 'react';
import { fragment, jsx } from './jsx.mjs';
import { controlsObserver } from './example.mjs';
import { Controls } from './controls.mjs';
import { ErrorBoundary } from './error-boundary.mjs';

const debug = true;

/**
 * @typedef {object} Props
 * @property {string} path
 * @property {(exampleSource: string) => void} setSourceCode
 */

/**
 * @typedef {object} State
 * @property {boolean} exampleLoaded
 * @property {Function} controls
 */

/** @type {typeof Component<Props, State>} */
const c = Component;

class ControlLoader extends c {
    state = {
        exampleLoaded: false,
        //controls: () => jsx('pre', null, 'Status: initial'),
        controls: () => undefined,
    };
    /**
     * @param {Props} props 
     */
    constructor(props) {
        super(props);
        const self = this;
        window.addEventListener('exampleLoading', (e) => {
            if (debug) {
                console.log("ControlLoader event: exampleLoading, event=", e);
            }
            self.setState({
                exampleLoaded: false,
                //controls: () => jsx('h1', null, 'state: reload'),
                controls: null,
            });
        });
        window.addEventListener('exampleLoad', (event) => {
            if (debug) {
                console.log("ControlLoader event: exampleLoad, event =", event);
            }
            /** @type {Record<string, string>} */
            const files = event.files;
            const controlsSrc = files['controls.mjs'];
            if (controlsSrc) {
                let controls;
                try {
                    controls = Function('return ' + controlsSrc)();
                } catch (e) {
                    controls = () => jsx('pre', null, 'error: ' + e.toString());
                }
                self.setState({
                    ...self.state,
                    exampleLoaded: true,
                    controls,
                });
                // console.log("controlsSrc", controlsSrc);
            } else {
                // When switching examples from one with controls to one without controls...
                self.setState({
                    ...self.state,
                    exampleLoaded: true,
                    controls: null,
                });
            }
            const activeDevice = event.deviceType;
            controlsObserver.emit('updateActiveDevice', activeDevice);
        });
        window.addEventListener('updateFiles', (event) => {
            if (debug) {
                console.log("ControlLoader event: updateFiles, event =", event);
            }
            const files = event.detail.files;
            // console.log("updateFiles", files);
            const controlsSrc = files['controls.mjs'] ?? 'null';
            if (!files['controls.mjs']) {
                this.setState({
                    exampleLoaded: true,
                    controls: null,
                });
            }
            let controls;
            try {
                controls = Function('return ' + controlsSrc)();
            } catch (e) {
                controls = () => jsx('pre', null, e.toString());
            }
            this.setState({
                exampleLoaded: true,
                controls,
            });
        });
    }
    /**
     * @param {Readonly<Props>} prevProps 
     */
    componentDidUpdate(prevProps) {
        // console.log("ControlLoader, componentDidUpdate prevProps.path", prevProps.path,  "this.props.path", this.props.path);
        if (prevProps.path !== this.props.path) {
            this.setState({
                exampleLoaded: false,
                controls: () => jsx('h1', null, 'ControlLoader#componentDidUpate'),
            });
        }
    }
    render() {
        // console.log('ControlLoader#render> exampleLoaded', this.state.exampleLoaded);
        return fragment(
            this.state.exampleLoaded && window.pc?.app && this.state.controls && jsx(
                ErrorBoundary,
                null,
                jsx(Controls, {
                    controls: jsx(this.state.controls, {
                        observer: window.observerData
                    })
                })
            ),
        );
    }
}

export { ControlLoader };
