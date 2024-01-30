import { withRouter } from 'react-router-dom';
import examples from './helpers/example-data.mjs';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { iframePath } from '../assetPath.mjs';
import { DeviceSelector } from './device-selector.mjs';
import { ErrorBoundary } from './error-boundary.mjs';
import { jsx, fragment } from './jsx.mjs';
import { Panel, Container, Button, Spinner } from '@playcanvas/pcui/react';
import React, { Component } from 'react';
import MonacoEditor from "@monaco-editor/react";
import { iframeReady, iframeReload, iframeRequestFiles } from './iframeUtils.mjs';
import { getOrientation } from './utils.mjs';
import * as PCUI from '@playcanvas/pcui';
import * as ReactPCUI from '@playcanvas/pcui/react';
import './events.js';

/**
 * @typedef {object} ControlOptions
 * @property {import('@playcanvas/observer').Observer} observer - The observer.
 * @property {import('@playcanvas/pcui')} PCUI - The PCUI vanilla module.
 * @property {import('@playcanvas/pcui/react')} ReactPCUI - The PCUI React module.
 * @property {import('react')} React - The PCUI React module.
 * @property {import('./jsx.mjs').jsx} jsx - Shortcut for creating a React JSX Element.
 * @property {import('./jsx.mjs').fragment} fragment - Shortcut for creating a React JSX fragment.
 */

/**
 * @typedef {object} Props
 * @property {{params: {category: string, example: string}}} match - The match object.
 */

/**
 * @typedef {object} State
 * @property {'portrait' | 'landscape'} orientation - The orientation.
 * @property {boolean} collapsed - Collapsed or not.
 * @property {boolean} exampleLoaded - Example is loaded or not.
 * @property {Function | null} controls - Controls function from example.
 * @property {boolean} showDeviceSelector - Show device selector.
 * @property {'code' | 'parameters'} show - Used in case of mobile view.
 * @property {Record<string, string>} files - Files of example (controls, shaders, example itself)
 * @property {string} description - Description of example.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class Example extends TypedComponent {
    /** @type {State} */
    state = {
        orientation: getOrientation(),
        // @ts-ignore
        collapsed: window.top.innerWidth < MIN_DESKTOP_WIDTH,
        exampleLoaded: false,
        controls: () => undefined,
        showDeviceSelector: true,
        show: 'code',
        files: { 'example.mjs': '// loading' },
        description: ''
    };

    /**
     * @param {Partial<State>} state - The partial state to update.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    /**
     * Called for resizing and changing orientation of device.
     */
    onLayoutChange() {
        this.mergeState({ orientation: getOrientation() });
    }

    /**
     * @param {LoadingEvent} event - Event.
     */
    onExampleLoading(event) {
        this.mergeState({
            exampleLoaded: false,
            controls: null,
            showDeviceSelector: event.detail.showDeviceSelector
        });
    }

    /**
     * @param {LoadEvent} event - Event.
     */
    onExampleLoad(event) {
        const { files, description } = event;
        const controlsSrc = files['controls.mjs'];
        if (controlsSrc) {
            let controls;
            try {
                // eslint-disable-next-line no-new-func
                controls = new Function('return ' + controlsSrc)();
            } catch (e) {
                controls = () => jsx('pre', null, 'error: ' + e.toString());
            }
            this.mergeState({
                exampleLoaded: true,
                controls,
                files,
                description
            });
        } else {
            // When switching examples from one with controls to one without controls...
            this.mergeState({
                exampleLoaded: true,
                controls: null,
                files,
                description
            });
        }
    }

    /**
     * @param {UpdateFilesEvent} event - Event.
     */
    onUpdateFiles(event) {
        const files = event.detail.files;
        const controlsSrc = files['controls.mjs'] ?? 'null';
        if (!files['controls.mjs']) {
            this.mergeState({
                exampleLoaded: true,
                controls: null
            });
        }
        let controls;
        try {
            // eslint-disable-next-line no-new-func
            controls = new Function('return ' + controlsSrc)();
        } catch (e) {
            controls = () => jsx('pre', null, e.toString());
        }
        this.mergeState({
            exampleLoaded: true,
            controls
        });
    }

    componentDidMount() {
        // PCUI should just have a "onHeaderClick" but can't find anything
        const controlPanel = document.getElementById("controlPanel");
        if (!controlPanel) {
            return;
        }

        /** @type {HTMLElement | null} */
        const controlPanelHeader = controlPanel.querySelector('.pcui-panel-header');
        if (!controlPanelHeader) {
            return;
        }
        controlPanelHeader.onclick = () => this.toggleCollapse();

        // Other events
        this.handleRequestedFiles = this.handleRequestedFiles.bind(this);
        this.onLayoutChange = this.onLayoutChange.bind(this);
        this.onExampleLoading = this.onExampleLoading.bind(this);
        this.onExampleLoad = this.onExampleLoad.bind(this);
        this.onUpdateFiles = this.onUpdateFiles.bind(this);
        window.addEventListener("requestedFiles", this.handleRequestedFiles);
        window.addEventListener("resize", this.onLayoutChange);
        window.addEventListener("orientationchange", this.onLayoutChange);
        window.addEventListener('exampleLoading', this.onExampleLoading);
        window.addEventListener('exampleLoad', this.onExampleLoad);
        window.addEventListener('updateFiles', this.onUpdateFiles);
        iframeRequestFiles();
    }

    componentWillUnmount() {
        window.removeEventListener("requestedFiles", this.handleRequestedFiles);
        window.removeEventListener("resize", this.onLayoutChange);
        window.removeEventListener("orientationchange", this.onLayoutChange);
        window.removeEventListener('exampleLoading', this.onExampleLoading);
        window.removeEventListener('exampleLoad', this.onExampleLoad);
        window.removeEventListener('updateFiles', this.onUpdateFiles);
    }

    get path() {
        return `/${this.props.match.params.category}/${this.props.match.params.example}`;
    }

    get iframePath() {
        /** @type {{ category: string; name: string }} */
        // @ts-ignore
        const example = examples.paths[this.path];
        return `${iframePath}/${example.category}_${example.name}.html`;
        // TODO: Complete standalone ES6 version, currently ignored, because focus is on MVP
        // return `${iframePath}/index.html?category=${example.category}&example=${example.name}`;
    }

    renderDeviceSelector() {
        const { showDeviceSelector } = this.state;

        if (!showDeviceSelector) {
            return null;
        }

        return jsx(DeviceSelector, {
            onSelect: iframeReload // reload the iframe after updating the device
        });
    }

    renderControls() {
        const { exampleLoaded, controls } = this.state;
        const ready = exampleLoaded && controls && iframeReady();
        if (!ready) {
            return;
        }
        return jsx(
            ErrorBoundary,
            null,
            jsx(controls, {
                // @ts-ignore
                observer: window.observerData,
                PCUI,
                ReactPCUI,
                React,
                jsx,
                fragment
            })
        );
    }

    renderDescription() {
        const { exampleLoaded, description, orientation } = this.state;
        const ready = exampleLoaded && iframeReady();
        if (!ready) {
            return;
        }
        return jsx(
            Container,
            {
                id: 'descriptionPanel',
                class: orientation === 'portrait' ? 'mobile' : null
            },
            jsx('span', {
                dangerouslySetInnerHTML: {
                    __html: description
                }
            })
        );
    }

    /**
     * Not the nicest way to fetch UI state from a CSS class, but we are
     * lacking a onHeaderClick panel callback which could hand us the state.
     * This is still better than:
     * 1) Hoping that the toggle functionality just happens to be calibrated
     * to the on/off toggling.
     * 2) Setting "collapsed" state everywhere via informed guesses.
     *
     * @type {boolean}
     */
    get collapsed() {
        const controlPanel = document.getElementById("controlPanel");
        if (!controlPanel) {
            return false;
        }
        const collapsed = controlPanel.classList.contains("pcui-collapsed");
        return collapsed;
    }

    toggleCollapse() {
        this.mergeState({ collapsed: !this.collapsed });
    }

    /**
     * @param {HandleFilesEvent} event - Event.
     */
    handleRequestedFiles(event) {
        const files = event.detail;
        this.mergeState({ files });
    }

    renderPortrait() {
        const { collapsed, controls, show, files, description } = this.state;
        return fragment(
            jsx(Panel,
                {
                    id: 'controlPanel',
                    class: ['mobile'],
                    resizable: 'top',
                    headerText: 'CODE & CONTROLS',
                    collapsible: true,
                    collapsed
                },
                this.renderDeviceSelector(),
                jsx(
                    Container,
                    {
                        id: 'controls-wrapper',
                        class: controls ? 'has-controls' : null
                    },
                    jsx(
                        Container,
                        {
                            id: 'controlPanel-tabs',
                            class: 'tabs-container'
                        },
                        jsx(Button, {
                            text: 'CODE',
                            id: 'codeButton',
                            class: show === 'code' ? 'selected' : null,
                            onClick: () => this.mergeState({ show: 'code' })
                        }),
                        jsx(Button, {
                            text: 'PARAMETERS',
                            class: show === 'parameters' ? 'selected' : null,
                            id: 'paramButton',
                            onClick: () => this.mergeState({ show: 'parameters' })
                        }),
                        description ? jsx(Button, {
                            text: 'DESCRIPTION',
                            class: show === 'description' ? 'selected' : null,
                            id: 'descButton',
                            onClick: () => this.mergeState({ show: 'description' })
                        }) : null
                    ),
                    show === 'parameters' && jsx(
                        Container,
                        {
                            id: 'controlPanel-controls'
                        },
                        this.renderControls()
                    ),
                    show === 'code' && jsx(
                        MonacoEditor,
                        {
                            options: {
                                readOnly: true,
                                theme: 'vs-dark'
                            },
                            defaultLanguage: "javascript",
                            value: files['example.mjs']
                        }
                    )
                )
            ),
            this.renderDescription()
        );
    }

    renderLandscape() {
        const { collapsed } = this.state;
        return fragment(
            jsx(Panel,
                {
                    id: 'controlPanel',
                    class: ['landscape'],
                    resizable: 'top',
                    headerText: 'CONTROLS',
                    collapsible: true,
                    collapsed
                },
                this.renderDeviceSelector(),
                this.renderControls()
            ),
            this.renderDescription()
        );
    }

    render() {
        const { iframePath } = this;
        const { orientation, exampleLoaded } = this.state;
        return jsx(
            Container,
            {
                id: "canvas-container"
            },
            !exampleLoaded && jsx(Spinner, { size: 50 }),
            jsx("iframe", {
                id: "exampleIframe",
                key: iframePath,
                src: iframePath
            }),
            orientation === 'portrait' ? this.renderPortrait() : this.renderLandscape()
        );
    }
}

// @ts-ignore
const ExamptWithRouter = withRouter(Example);

export { ExamptWithRouter as Example };
