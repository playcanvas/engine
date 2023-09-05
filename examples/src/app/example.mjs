import { withRouter } from 'react-router-dom';
import { Observer } from '@playcanvas/observer';
import examples from './helpers/example-data.mjs';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { iframePath } from '../assetPath.mjs';
import { DeviceSelector } from './device-selector.mjs';
import { ErrorBoundary } from './error-boundary.mjs';
import { jsx, fragment, jsxBooleanInput, jsxSelectInput, jsxSliderInput, jsxButton, jsxContainer, jsxPanel, jsxSpinner  } from './jsx.mjs';
import { Panel, Container } from '@playcanvas/pcui/react';
import React, { useRef, createRef, Component, useEffect } from 'react';
import MonacoEditor from "@monaco-editor/react";
import { iframeReload, iframeRequestFiles } from './iframeUtils.mjs';
import { getOrientation } from './utils.mjs';
import * as PCUI from '@playcanvas/pcui';
import * as ReactPCUI from '@playcanvas/pcui/react';

/**
 * @typedef {object} ControlOptions
 * @property {import('@playcanvas/observer').Observer} observer - The observer.
 * @property {import('@playcanvas/pcui')} PCUI - The PCUI vanilla module.
 * @property {import('@playcanvas/pcui/react')} ReactPCUI - The PCUI React module.
 * @property {import('react')} React - The PCUI React module.
 * @property {import('./jsx.mjs').jsx} jsx - Shortcut for creating a React JSX Element.
 * @property {import('./jsx.mjs').fragment} fragment - Shortcut for creating a React JSX fragment.
 */

// Obsolete - Refactor away entirely TODO
// What the UI "controls" function needs. We are mixing React and PlayCanvas code in the examples and:
// 1) We don't want to load React code in iframe
// 2) We don't want to load PlayCanvas code in Examples browser
// (just to keep the file sizes as minimal as possible)
Object.assign(window, {
    Observer,
    jsx, fragment, jsxBooleanInput, jsxSelectInput, jsxSliderInput, jsxButton, jsxContainer, jsxPanel, jsxSpinner,
    React, useRef, createRef, Component, useEffect,
});

const controlsObserver = new Observer();

/**
 * @typedef {object} Props
 * @property {{params: {category: string, example: string}}} match
 */

/**
 * @typedef {object} State
 * @property {'portrait' | 'landscape'} orientation - The orientation.
 * @property {boolean} collapsed - Collapsed or not.
 * @property {boolean} exampleLoaded - Example is loaded or not.
 * @property {Function} controls - Controls function from example.
 * @property {boolean} showParameters - Used in case of mobile view.
 * @property {boolean} showCode - Used in case of mobile view.
 * @property {Record<string, string>} files - Files of example (controls, shaders, example itself)
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class Example extends TypedComponent {
    /** @type {State} */
    state = {
        orientation: getOrientation(),
        collapsed: window.top.innerWidth < MIN_DESKTOP_WIDTH,
        exampleLoaded: false,
        //controls: () => jsx('pre', null, 'Status: initial'),
        controls: () => undefined,
        showParameters: false,
        showCode: true,
        files: {'example.mjs': '// loading'}
    };

    /**
     * @param {Partial<State>} state - The partial state to update.
     */
    mergeState(state) {
        this.setState({ ...this.state, ...state});
    }

    /**
     * Called for resizing and changing orientation of device.
     */
    onLayoutChange() {
        this.mergeState({ orientation: getOrientation() });
    }

    onExampleLoading() {
        this.mergeState({
            exampleLoaded: false,
            //controls: () => jsx('h1', null, 'state: reload'),
            controls: null,
        });
    }

    onExampleLoad(event) {
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
            this.mergeState({
                exampleLoaded: true,
                controls,
                files,
            });
            // console.log("controlsSrc", controlsSrc);
        } else {
            // When switching examples from one with controls to one without controls...
            this.mergeState({
                exampleLoaded: true,
                controls: null,
                files,
            });
        }
        const activeDevice = event.deviceType;
        controlsObserver.emit('updateActiveDevice', activeDevice);
    }

    onUpdateFiles(event) {
        const files = event.detail.files;
        // console.log("updateFiles", files);
        const controlsSrc = files['controls.mjs'] ?? 'null';
        if (!files['controls.mjs']) {
            this.mergeState({
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
        this.mergeState({
            exampleLoaded: true,
            controls,
        });
    }
    
    componentDidMount() {
        // PCUI should just have a "onHeaderClick" but can't find anything
        const controlPanel = document.getElementById("controlPanel");
        const controlPanelHeader = controlPanel.querySelector('.pcui-panel-header');
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
        const example = examples.paths[this.path];
        return `${iframePath}/${example.category}_${example.name}.html`;
        // todo: Complete standalone ES6 version, currently ignored, because focus is on MVP
        // return `${iframePath}/index.html?category=${example.category}&example=${example.name}`;
    }

    onClickParametersTab() {
        this.mergeState({
            showParameters: true,
            showCode: false,
        });
    };

    onClickCodeTab() {
        this.mergeState({
            showParameters: false,
            showCode: true,
        });
    };

    renderDeviceSelector() {
        return jsx(DeviceSelector, {
            onSelect: iframeReload, // reload the iframe after updating the device
            observer: controlsObserver,
        });
    }

    renderControls() {
        const { exampleLoaded, controls } = this.state;
        const ready = exampleLoaded && controls && window.pc?.app;
        if (!ready) {
            return;
        }
        return jsx(
            ErrorBoundary,
            null,
            jsx(this.state.controls, {
                observer: window.observerData,
                PCUI,
                ReactPCUI,
                React,
                jsx,
                fragment,
            }),
        );
    }

    toggleCollapse() {
        const { collapsed } = this.state;
        this.mergeState({
            collapsed: !collapsed,
        });
        //console.log("Example#toggleCollapse> was ", collapsed);
    }

    handleRequestedFiles(event) {
        // console.log('Example#handleRequestedFiles, files: ', event.detail);
        const files = event.detail;
        this.mergeState({ files });
    }

    renderPortrait() {
        const { collapsed, controls, showCode, showParameters, files } = this.state;
        return jsx(Panel,
            {
                id: 'controlPanel',
                class: ['mobile'],
                resizable: 'top',
                headerText: 'CODE & CONTROLS',
                collapsible: true,
                collapsed,
                //header: jsx('h1', null, "data header"),
                //onClick: this.toggleCollapse.bind(this),
                //onExpand: this.toggleCollapse.bind(this),  
            },
            // jsx('button', null, "Example#renderPortrait()"),
            this.renderDeviceSelector(),
            //this.renderControls(),
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
                    jsxButton({
                        text: 'CODE',
                        id: 'codeButton',
                        class: showCode ? 'selected' : null,
                        onClick: this.onClickCodeTab.bind(this),
                    }),
                    jsxButton({
                        text: 'PARAMETERS',
                        class: showParameters ? 'selected' : null,
                        id: 'paramButton',
                        onClick: this.onClickParametersTab.bind(this),
                    }),
                ),
                showParameters && jsx(
                    Container,
                    {
                        id: 'controlPanel-controls'
                    },
                    this.renderControls(),
                ),
                showCode && jsx(
                    MonacoEditor,
                    {
                        options: {
                            readOnly: true
                        },
                        defaultLanguage: "typescript",
                        value: files['example.mjs'],
                    }
                )
            )
        );
    }

    renderLandscape() {
        const { collapsed } = this.state;
        return fragment(
            jsxPanel(
                {
                    id: 'controlPanel',
                    class: ['landscape'],
                    resizable: 'top',
                    headerText: 'CONTROLS',
                    collapsible: true,
                    collapsed,
                },
                // jsx('button', null, "Example#renderLandscape"),
                this.renderDeviceSelector(),
                this.renderControls(),
                //jsx(SideBar, null),
                //jsx(CodeEditor, {
                //    lintErrors: false,
                //    setLintErrors: () => console.log("set lint errors", ...arguments),
                //}),
                //jsx('pre', null, JSON.stringify(this.state, null, 2)),
            )
        );
    }

    render() {
        const { iframePath } = this;
        const { orientation } = this.state;
        //console.log("Example#render", JSON.stringify(this.state, null, 2));
        return jsxContainer(
            {
                id: "canvas-container"
            },
            jsxSpinner({ size: 50 }),
            jsx("iframe", {
                id: "exampleIframe",
                key: iframePath,
                src: iframePath
            }),
            orientation === 'portrait' ? this.renderPortrait() : this.renderLandscape(),
        );       
    }
}

const ExamptWithRouter = withRouter(Example);

export {
    ExamptWithRouter as Example,
    controlsObserver,
};
