import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import * as PCUI from '@playcanvas/pcui';
import * as ReactPCUI from '@playcanvas/pcui/react';
import { Panel, Container, Button, Spinner } from '@playcanvas/pcui/react';

import { DeviceSelector } from './DeviceSelector.mjs';
import { CodeEditorMobile } from './code-editor/CodeEditorMobile.mjs';
import { ErrorBoundary } from './ErrorBoundary.mjs';

import { MIN_DESKTOP_WIDTH } from '../constants.mjs';
import { iframePath } from '../paths.mjs';
import { jsx, fragment } from '../jsx.mjs';
import { iframe } from '../iframe.mjs';
import { getOrientation } from '../utils.mjs';

/** @typedef {import('../events.js').StateEvent} StateEvent */
/** @typedef {import('../events.js').LoadingEvent} LoadingEvent */

/**
 * @template {Record<string, string>} [FILES=Record<string, string>]
 * @typedef {object} ExampleOptions
 * @property {Function} loadES5 - The async function to load ES5 files.
 * @property {HTMLCanvasElement} canvas - The canvas.
 * @property {string} deviceType - The device type.
 * @property {import('@playcanvas/observer').Observer} data - The data.
 * @property {FILES} files - The files.
 */

/**
 * @typedef {object} ControlOptions
 * @property {import('@playcanvas/observer').Observer} observer - The PCUI observer.
 * @property {import('@playcanvas/pcui')} PCUI - The PCUI vanilla module.
 * @property {import('@playcanvas/pcui/react')} ReactPCUI - The PCUI React module.
 * @property {import('react')} React - The PCUI React module.
 * @property {import('../jsx.mjs').jsx} jsx - Shortcut for creating a React JSX Element.
 * @property {import('../jsx.mjs').fragment} fragment - Shortcut for creating a React JSX fragment.
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
 * @property {import('@playcanvas/observer').Observer | null} observer - The PCUI observer
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
        observer: null,
        description: ''
    };

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._onLayoutChange = this._onLayoutChange.bind(this);
        this._handleRequestedFiles = this._handleRequestedFiles.bind(this);
        this._handleExampleLoading = this._handleExampleLoading.bind(this);
        this._handleExampleLoad = this._handleExampleLoad.bind(this);
        this._handleUpdateFiles = this._handleUpdateFiles.bind(this);
    }

    /**
     * @param {string} src - The source string.
     * @returns {Promise<Function>} - The controls jsx object.
     */
    async _buildControls(src) {
        const blob = new Blob([src], { type: 'text/javascript' });
        if (this._controlsUrl) {
            URL.revokeObjectURL(this._controlsUrl);
        }
        this._controlsUrl = URL.createObjectURL(blob);
        let controls;
        try {
            const module = await import(this._controlsUrl);
            controls = module.controls;
        } catch (e) {
            controls = () => jsx('pre', null, e.message);
        }
        return controls;
    }

    /**
     * @param {StateEvent} event - The event.
     */
    _handleRequestedFiles(event) {
        const { files } = event.detail;
        this.mergeState({ files });
    }

    /**
     * Called for resizing and changing orientation of device.
     */
    _onLayoutChange() {
        this.mergeState({ orientation: getOrientation() });
    }

    /**
     * @param {LoadingEvent} event - The event
     */
    _handleExampleLoading(event) {
        const { showDeviceSelector } = event.detail;
        this.mergeState({
            exampleLoaded: false,
            controls: null,
            showDeviceSelector: showDeviceSelector
        });
    }

    /**
     * @param {StateEvent} event - The event.
     */
    async _handleExampleLoad(event) {
        const { files, observer, description } = event.detail;
        const controlsSrc = files['controls.mjs'];
        if (controlsSrc) {
            const controls = await this._buildControls(controlsSrc);
            this.mergeState({
                exampleLoaded: true,
                controls,
                observer,
                files,
                description
            });
        } else {
            // When switching examples from one with controls to one without controls...
            this.mergeState({
                exampleLoaded: true,
                controls: null,
                observer: null,
                files,
                description
            });
        }
    }

    /**
     * @param {StateEvent} event - The event.
     */
    async _handleUpdateFiles(event) {
        const { files, observer } = event.detail;
        const controlsSrc = files['controls.mjs'] ?? '';
        if (!files['controls.mjs']) {
            this.mergeState({
                exampleLoaded: true,
                controls: null,
                observer: null
            });
        }
        const controls = await this._buildControls(controlsSrc);
        this.mergeState({
            exampleLoaded: true,
            controls,
            observer
        });
        window.dispatchEvent(new CustomEvent('resetErrorBoundary'));
    }

    /**
     * @param {Partial<State>} state - The partial state to update.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    componentDidMount() {
        // PCUI should just have a "onHeaderClick" but can't find anything
        const controlPanel = document.getElementById('controlPanel');
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
        window.addEventListener('resize', this._onLayoutChange);
        window.addEventListener('requestedFiles', this._handleRequestedFiles);
        window.addEventListener('orientationchange', this._onLayoutChange);
        window.addEventListener('exampleLoading', this._handleExampleLoading);
        window.addEventListener('exampleLoad', this._handleExampleLoad);
        window.addEventListener('updateFiles', this._handleUpdateFiles);
        iframe.fire('requestFiles');
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this._onLayoutChange);
        window.removeEventListener('requestedFiles', this._handleRequestedFiles);
        window.removeEventListener('orientationchange', this._onLayoutChange);
        window.removeEventListener('exampleLoading', this._handleExampleLoading);
        window.removeEventListener('exampleLoad', this._handleExampleLoad);
        window.removeEventListener('updateFiles', this._handleUpdateFiles);
    }

    get path() {
        return `/${this.props.match.params.category}/${this.props.match.params.example}`;
    }

    get iframePath() {
        const categoryKebab = this.props.match.params.category;
        const exampleNameKebab = this.props.match.params.example;
        return `${iframePath}/${categoryKebab}_${exampleNameKebab}.html`;
    }

    renderDeviceSelector() {
        const { showDeviceSelector } = this.state;

        if (!showDeviceSelector) {
            return null;
        }

        return jsx(DeviceSelector, {
            onSelect: () => iframe.reload() // reload the iframe after updating the device
        });
    }

    renderControls() {
        const { exampleLoaded, controls, observer } = this.state;
        const ready = exampleLoaded && controls && observer && iframe.ready;
        if (!ready) {
            return;
        }
        return jsx(
            ErrorBoundary,
            null,
            jsx(controls, {
                observer,
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
        const ready = exampleLoaded && iframe.ready;
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
        const controlPanel = document.getElementById('controlPanel');
        if (!controlPanel) {
            return false;
        }
        const collapsed = controlPanel.classList.contains('pcui-collapsed');
        return collapsed;
    }

    toggleCollapse() {
        this.mergeState({ collapsed: !this.collapsed });
    }

    renderPortrait() {
        const { collapsed, show, files, description } = this.state;
        return fragment(
            jsx(
                Panel,
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
                        id: 'controls-wrapper'
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
                        description ?
                            jsx(Button, {
                                text: 'DESCRIPTION',
                                class: show === 'description' ? 'selected' : null,
                                id: 'descButton',
                                onClick: () => this.mergeState({ show: 'description' })
                            }) :
                            null
                    ),
                    show === 'parameters' &&
                        jsx(
                            Container,
                            {
                                id: 'controlPanel-controls'
                            },
                            this.renderControls()
                        ),
                    show === 'code' && jsx(CodeEditorMobile, { files })
                )
            ),
            this.renderDescription()
        );
    }

    renderLandscape() {
        const { collapsed } = this.state;
        return fragment(
            jsx(
                Panel,
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
                id: 'canvas-container'
            },
            !exampleLoaded && jsx(Spinner, { size: 50 }),
            jsx('iframe', {
                id: 'exampleIframe',
                key: iframePath,
                src: iframePath
            }),
            orientation === 'portrait' ? this.renderPortrait() : this.renderLandscape()
        );
    }
}

// @ts-ignore
const ExampleWithRouter = withRouter(Example);

export { ExampleWithRouter as Example };
