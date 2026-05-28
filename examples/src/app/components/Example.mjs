import * as PCUI from '@playcanvas/pcui';
import * as ReactPCUI from '@playcanvas/pcui/react';
import { Panel, Container, Button, Spinner } from '@playcanvas/pcui/react';
import React, { Component } from 'react';
import { useParams } from 'react-router-dom';

import { CodeEditorMobile } from './code-editor/CodeEditorMobile.mjs';
import { DeviceSelector } from './DeviceSelector.mjs';
import { ErrorBoundary } from './ErrorBoundary.mjs';
import { SelectInput as OverlaySelectInput } from './OverlaySelectInput.mjs';
import { COLOR_NAMES, INLINE_MD_PATTERN, SAFE_URL_PATTERN } from '../../../utils/inline-markdown.mjs';
import { CLOSE_SELECTS_EVENT } from '../constants.mjs';
import { iframe } from '../iframe.mjs';
import { jsx, fragment } from '../jsx.mjs';
import { iframePath } from '../paths.mjs';
import { getLayout } from '../utils.mjs';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ComponentType, ReactElement } from 'react'
 * @import { Credit, ErrorEvent as ExampleErrorEvent, LoadingEvent, StateEvent } from '../events.js'
 */

const PC_IMPORT = /^[ \t]*import[\s\w*{},]+["']playcanvas["'];?[ \t]*(?:\r?\n|$)/gm;
const CONTROLS_REACT_PCUI = /** @satisfies {typeof ReactPCUI} */ ({
    ...ReactPCUI,
    SelectInput: OverlaySelectInput
});
const URL_IN_TEXT_PATTERN = /(https?:\/\/[^\s)]+)/;

/**
 * Renders a plain-text description with a markdown-lite inline subset:
 * `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, and `{color:text}`.
 * Output is a React node array, never an HTML string, so the text content
 * is always auto-escaped by React. Link URLs are restricted to http(s) and
 * mailto. Color names are restricted to a fixed whitelist mapped to CSS
 * classes; unknown names are passed through as literal text.
 *
 * @param {string} text - The source text.
 * @returns {(string | ReactElement)[]} The rendered nodes.
 */
const renderInlineMarkdown = (text) => {
    const nodes = [];
    let lastIndex = 0;
    let key = 0;
    INLINE_MD_PATTERN.lastIndex = 0;
    let match;
    while ((match = INLINE_MD_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }
        if (match[1] !== undefined) {
            nodes.push(jsx('strong', { key: key++ }, match[1]));
        } else if (match[2] !== undefined) {
            nodes.push(jsx('em', { key: key++ }, match[2]));
        } else if (match[3] !== undefined) {
            nodes.push(jsx('code', { key: key++ }, match[3]));
        } else if (match[4] !== undefined) {
            const href = SAFE_URL_PATTERN.test(match[5]) ? match[5] : '#';
            nodes.push(jsx('a', {
                key: key++,
                href,
                target: '_blank',
                rel: 'noopener'
            }, match[4]));
        } else if (COLOR_NAMES.has(match[6])) {
            nodes.push(jsx('span', {
                key: key++,
                className: `example-color-${match[6]}`
            }, match[7]));
        } else {
            nodes.push(match[0]);
        }
        lastIndex = INLINE_MD_PATTERN.lastIndex;
    }
    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }
    return nodes;
};

/** @type {Record<string, string>} */
const MOBILE_PANEL_TITLES = {
    examples: 'EXAMPLES',
    code: 'SOURCE',
    controls: 'CONTROLS',
    description: 'INFO'
};

/**
 * @template {Record<string, string>} [FILES=Record<string, string>]
 * @typedef {object} ExampleOptions
 * @property {HTMLCanvasElement} canvas - The canvas.
 * @property {string} deviceType - The device type.
 * @property {Observer} data - The data.
 * @property {FILES} files - The files.
 */

/**
 * @typedef {object} ControlOptions
 * @property {Observer} observer - The PCUI observer.
 * @property {typeof PCUI} PCUI - The PCUI vanilla module.
 * @property {typeof ReactPCUI} ReactPCUI - The PCUI React module.
 * @property {typeof React} React - The PCUI React module.
 * @property {typeof jsx} jsx - Shortcut for creating a React JSX Element.
 * @property {typeof fragment} fragment - Shortcut for creating a React JSX fragment.
 */

/**
 * @typedef {ComponentType<ControlOptions>} Control
 */

/**
 * @typedef {object} Props
 * @property {{params: {category: string, example: string}}} match - The match object.
 * @property {'mobile'|'desktop'} [layout] - Current layout.
 * @property {null|'examples'|'code'|'controls'|'description'} [mobilePanel] - Active mobile panel.
 * @property {(mobilePanel: null|'examples'|'code'|'controls'|'description') => void} [setMobilePanel] - Set active mobile panel.
 * @property {boolean} [showCredits] - Whether the desktop credits overlay is visible.
 * @property {(event: PointerEvent | import('react').PointerEvent<HTMLElement>) => void} [onMobilePanelDragStart] - Start mobile panel drag.
 */

/**
 * @typedef {object} State
 * @property {'mobile' | 'desktop'} layout - The layout.
 * @property {boolean} collapsed - Collapsed or not.
 * @property {boolean} exampleLoaded - Example is loaded or not.
 * @property {string} loadedPath - The loaded iframe path.
 * @property {{ path: string, message: string } | null} loadError - The current loading error.
 * @property {Control | null} controls - Controls function from example.
 * @property {Observer | null} observer - The PCUI observer
 * @property {boolean} showDeviceSelector - Show device selector.
 * @property {Record<string, string>} files - Files of example (controls, shaders, example itself)
 * @property {string} description - Description of example.
 * @property {Credit[]} credits - Credits for the example.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class Example extends TypedComponent {
    /** @type {State} */
    state = {
        layout: getLayout(),
        collapsed: getLayout() === 'mobile',
        exampleLoaded: false,
        loadedPath: '',
        loadError: null,
        controls: () => null,
        showDeviceSelector: true,
        files: { 'example.mjs': '// loading' },
        observer: null,
        description: '',
        credits: []
    };

    /** @type {HTMLElement | null} */
    _controlPanelScrollRegion = null;

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._onLayoutChange = this._onLayoutChange.bind(this);
        this._handleRequestedFiles = this._handleRequestedFiles.bind(this);
        this._handleExampleLoading = this._handleExampleLoading.bind(this);
        this._handleExampleLoad = this._handleExampleLoad.bind(this);
        this._handleExampleHotReload = this._handleExampleHotReload.bind(this);
        this._handleExampleError = this._handleExampleError.bind(this);
        this._handleUpdateFiles = this._handleUpdateFiles.bind(this);
        this._handleControlPanelScroll = this._handleControlPanelScroll.bind(this);
        this._reloadIframe = this._reloadIframe.bind(this);
    }

    /**
     * @param {string} src - The source string.
     * @returns {Promise<Control>} - The controls jsx object.
     */
    async _buildControls(src) {
        const runtime = src.replace(PC_IMPORT, 'const pc = window.pc;\n');
        const blob = new Blob([runtime], { type: 'text/javascript' });
        if (this._controlsUrl) {
            URL.revokeObjectURL(this._controlsUrl);
        }
        this._controlsUrl = URL.createObjectURL(blob);
        /** @type {Control} */
        let controls;
        try {
            // eslint-disable-next-line jsdoc/no-bad-blocks
            const module = await import(/* @vite-ignore */ this._controlsUrl);
            controls = module.controls;
        } catch (e) {
            controls = () => jsx('pre', null, /** @type {any} */ (e).message);
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
     * Called for resizing and changing layout.
     */
    _onLayoutChange() {
        this.mergeState({ layout: getLayout() });
    }

    /**
     * @param {LoadingEvent} event - The event
     */
    _handleExampleLoading(event) {
        const { showDeviceSelector } = event.detail;
        this.mergeState({
            exampleLoaded: false,
            loadedPath: '',
            loadError: null,
            controls: null,
            showDeviceSelector: showDeviceSelector,
            description: '',
            credits: []
        });
    }

    /**
     * @param {StateEvent} event - The event.
     */
    async _handleExampleLoad(event) {
        const path = this.iframePath;
        const { files, observer, description, credits = [] } = event.detail;
        const controlsSrc = files['controls.mjs'];
        if (!description && !credits.length && this.props.mobilePanel === 'description') {
            this.props.setMobilePanel?.(null);
        }
        if (controlsSrc) {
            const controls = await this._buildControls(controlsSrc);
            this.mergeState({
                exampleLoaded: true,
                loadedPath: path,
                loadError: null,
                controls,
                observer,
                files,
                description,
                credits
            });
        } else {
            // When switching examples from one with controls to one without controls...
            this.mergeState({
                exampleLoaded: true,
                loadedPath: path,
                loadError: null,
                controls: null,
                observer: null,
                files,
                description,
                credits
            });
        }
    }

    _handleExampleHotReload() {
        this.mergeState({
            exampleLoaded: false,
            loadedPath: '',
            loadError: null
        });
    }

    _reloadIframe() {
        this.setState({
            exampleLoaded: false,
            loadedPath: '',
            loadError: null
        }, () => requestAnimationFrame(() => iframe.reload()));
    }

    /**
     * @param {ExampleErrorEvent} event - The event.
     */
    _handleExampleError(event) {
        const { exampleLoaded, loadedPath } = this.state;
        if (exampleLoaded && loadedPath === this.iframePath) {
            return;
        }
        const { name, message } = event.detail;
        this.mergeState({
            exampleLoaded: false,
            loadError: {
                path: this.iframePath,
                message: `${name}: ${message}`
            }
        });
    }

    /**
     * @param {StateEvent} event - The event.
     */
    async _handleUpdateFiles(event) {
        const path = this.iframePath;
        const { files, observer, description, credits = [] } = event.detail;
        const controlsSrc = files['controls.mjs'] ?? '';
        if (!files['controls.mjs']) {
            this.mergeState({
                exampleLoaded: true,
                loadedPath: path,
                loadError: null,
                controls: null,
                observer: null,
                description,
                credits
            });
        }
        const controls = await this._buildControls(controlsSrc);
        this.mergeState({
            exampleLoaded: true,
            loadedPath: path,
            loadError: null,
            controls,
            observer,
            description,
            credits
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

    _handleControlPanelScroll() {
        window.dispatchEvent(new Event(CLOSE_SELECTS_EVENT));
    }

    setupControlPanel() {
        const controlPanel = document.getElementById('controlPanel');
        if (!controlPanel) {
            this._controlPanelScrollRegion?.removeEventListener('scroll', this._handleControlPanelScroll);
            this._controlPanelScrollRegion = null;
            return;
        }

        const scrollRegion = document.getElementById('controlPanel-scroll-region');
        if (this._controlPanelScrollRegion !== scrollRegion) {
            this._controlPanelScrollRegion?.removeEventListener('scroll', this._handleControlPanelScroll);
            this._controlPanelScrollRegion = scrollRegion;
            this._controlPanelScrollRegion?.addEventListener('scroll', this._handleControlPanelScroll, { passive: true });
        }

        // PCUI should just have a "onHeaderClick" but can't find anything
        const controlPanelHeader = /** @type {HTMLElement | null} */ (
            /** @type {unknown} */ (controlPanel.querySelector('.pcui-panel-header'))
        );
        if (!controlPanelHeader) {
            return;
        }

        if (controlPanel.classList.contains('mobile')) {
            const drag = this.props.onMobilePanelDragStart;
            controlPanel.onpointerdown = drag ? event => drag(event) : null;
            controlPanelHeader.onclick = null;
            controlPanelHeader.onpointerdown = null;
            return;
        }

        controlPanel.onpointerdown = null;
        controlPanelHeader.onpointerdown = null;
        controlPanelHeader.onclick = () => this.toggleCollapse();
    }

    componentDidMount() {
        this.setupControlPanel();
        window.addEventListener('resize', this._onLayoutChange);
        window.addEventListener('requestedFiles', this._handleRequestedFiles);
        window.addEventListener('orientationchange', this._onLayoutChange);
        window.addEventListener('exampleLoading', this._handleExampleLoading);
        window.addEventListener('exampleLoad', this._handleExampleLoad);
        window.addEventListener('exampleHotReload', this._handleExampleHotReload);
        window.addEventListener('exampleError', this._handleExampleError);
        window.addEventListener('updateFiles', this._handleUpdateFiles);
        iframe.fire('requestFiles');
    }

    /**
     * @param {Props} prevProps - Previous component properties.
     */
    componentDidUpdate(prevProps) {
        const prevParams = prevProps.match.params;
        const params = this.props.match.params;
        if (prevParams.category !== params.category || prevParams.example !== params.example) {
            window.dispatchEvent(new Event(CLOSE_SELECTS_EVENT));
        }

        this.setupControlPanel();
    }

    componentWillUnmount() {
        window.dispatchEvent(new Event(CLOSE_SELECTS_EVENT));
        this._controlPanelScrollRegion?.removeEventListener('scroll', this._handleControlPanelScroll);
        this._controlPanelScrollRegion = null;
        window.removeEventListener('resize', this._onLayoutChange);
        window.removeEventListener('requestedFiles', this._handleRequestedFiles);
        window.removeEventListener('orientationchange', this._onLayoutChange);
        window.removeEventListener('exampleLoading', this._handleExampleLoading);
        window.removeEventListener('exampleLoad', this._handleExampleLoad);
        window.removeEventListener('exampleHotReload', this._handleExampleHotReload);
        window.removeEventListener('exampleError', this._handleExampleError);
        window.removeEventListener('updateFiles', this._handleUpdateFiles);
    }

    get path() {
        return `/${this.props.match.params.category}/${this.props.match.params.example}`;
    }

    get iframePath() {
        const categoryKebab = this.props.match.params.category;
        const exampleNameKebab = this.props.match.params.example;
        return `${iframePath}${categoryKebab}_${exampleNameKebab}.html`;
    }

    renderDeviceSelector() {
        const { showDeviceSelector } = this.state;

        if (!showDeviceSelector) {
            return null;
        }

        return jsx(DeviceSelector, {
            onSelect: this._reloadIframe
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
                ReactPCUI: CONTROLS_REACT_PCUI,
                React,
                jsx,
                fragment
            })
        );
    }

    /**
     * @param {string} href - link href.
     * @param {ReactElement | string} content - link content.
     * @returns {ReactElement} rendered link.
     */
    renderCreditLink(href, content) {
        return jsx('a', {
            href,
            target: '_blank',
            rel: 'noopener'
        }, content);
    }

    /**
     * @param {string} license - license value.
     * @returns {ReactElement | string} rendered license.
     */
    renderLicenseLink(license) {
        const match = URL_IN_TEXT_PATTERN.exec(license);
        if (!match) {
            return license;
        }

        const label = license.slice(0, match.index).trim().replace(/\s*\($/, '').trim();
        return this.renderCreditLink(match[1], label || 'License');
    }

    /**
     * @param {Credit} credit - credit data.
     * @param {number} index - credit index.
     * @returns {ReactElement} rendered credit row.
     */
    renderCredit(credit, index) {
        const source = credit.source ? URL_IN_TEXT_PATTERN.exec(credit.source) : null;
        const label = fragment(
            jsx('span', { className: 'example-credit-title' }, credit.title),
            ' by ',
            jsx('span', { className: 'example-credit-author' }, credit.author)
        );
        const children = [source ? this.renderCreditLink(source[1], label) : label];
        if (!source && credit.source) {
            children.push(' \u00b7 ', credit.source);
        }
        if (credit.license) {
            children.push(' \u00b7 ', this.renderLicenseLink(credit.license));
        }
        return jsx(
            'p',
            {
                className: 'example-credit',
                key: index
            },
            ...children
        );
    }

    renderCredits() {
        const { credits } = this.state;
        if (!credits.length) {
            return null;
        }

        return jsx(
            Panel,
            {
                class: ['example-info-subpanel'],
                headerText: 'Credits'
            },
            jsx(
                Container,
                {
                    class: ['example-credits']
                },
                credits.map((credit, index) => this.renderCredit(credit, index))
            )
        );
    }

    /**
     * @param {string} id - The info content id.
     * @param {boolean} [includeDescription] - Whether to include the description block.
     * @returns {ReactElement} rendered info content.
     */
    renderInfoContent(id, includeDescription = false) {
        const { description } = this.state;
        return jsx(
            Container,
            {
                id,
                class: ['example-info-content']
            },
            includeDescription && description ?
                jsx(
                    'div',
                    {
                        className: 'example-description-body example-info-description'
                    },
                    renderInlineMarkdown(description)
                ) :
                null,
            this.renderCredits()
        );
    }

    renderDescription() {
        const { exampleLoaded, description } = this.state;
        if (!exampleLoaded || !description || !iframe.ready) {
            return null;
        }
        return jsx(
            'div',
            {
                id: 'exampleDescription',
                className: 'example-description-body'
            },
            renderInlineMarkdown(description)
        );
    }

    renderCreditsOverlay() {
        const { exampleLoaded, credits } = this.state;
        const { showCredits, layout } = this.props;
        if (layout !== 'desktop' || !showCredits || !exampleLoaded || !iframe.ready || !credits.length) {
            return null;
        }
        return jsx(
            'div',
            { id: 'exampleCredits' },
            credits.map((credit, index) => this.renderCredit(credit, index))
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

    renderMobilePanel() {
        const { mobilePanel } = this.props;
        const { files } = this.state;

        if (mobilePanel === 'code') {
            return jsx(CodeEditorMobile, {
                key: 'code',
                files,
                category: this.props.match.params.category,
                example: this.props.match.params.example
            });
        }

        if (mobilePanel === 'description') {
            return this.renderInfoContent('mobileInfoPanel', true);
        }

        if (mobilePanel === 'controls') {
            return jsx(
                Container,
                {
                    key: 'controls',
                    id: 'mobileControlsPanel'
                },
                this.renderDeviceSelector(),
                jsx(
                    Container,
                    {
                        id: 'controlPanel-scroll-region'
                    },
                    jsx(
                        Container,
                        {
                            id: 'controlPanel-controls'
                        },
                        this.renderControls()
                    )
                )
            );
        }
    }

    renderMobileDock() {
        const { mobilePanel, setMobilePanel } = this.props;
        const { description, credits } = this.state;
        const hasInfo = description || credits.length;
        return jsx(
            Container,
            {
                id: 'mobileDock'
            },
            jsx(Button, {
                key: 'examples',
                text: 'Examples',
                class: mobilePanel === 'examples' ?
                    ['mobile-dock-button', 'mobile-dock-examples', 'selected'] :
                    ['mobile-dock-button', 'mobile-dock-examples'],
                onClick: () => setMobilePanel?.('examples')
            }),
            jsx(Button, {
                key: 'code',
                text: 'Source',
                class: mobilePanel === 'code' ?
                    ['mobile-dock-button', 'mobile-dock-code', 'selected'] :
                    ['mobile-dock-button', 'mobile-dock-code'],
                onClick: () => setMobilePanel?.('code')
            }),
            jsx(Button, {
                key: 'controls',
                text: 'Controls',
                class: mobilePanel === 'controls' ?
                    ['mobile-dock-button', 'mobile-dock-controls', 'selected'] :
                    ['mobile-dock-button', 'mobile-dock-controls'],
                onClick: () => setMobilePanel?.('controls')
            }),
            jsx(Button, {
                key: 'description',
                text: 'Info',
                enabled: Boolean(hasInfo),
                class: mobilePanel === 'description' ?
                    ['mobile-dock-button', 'mobile-dock-description', 'selected'] :
                    ['mobile-dock-button', 'mobile-dock-description'],
                onClick: () => setMobilePanel?.('description')
            })
        );
    }

    renderMobile() {
        const { mobilePanel } = this.props;
        const activePanel = mobilePanel && mobilePanel !== 'examples' ? mobilePanel : null;
        return jsx(
            Container,
            {
                id: 'mobileUi'
            },
            activePanel && jsx(
                Panel,
                {
                    key: activePanel,
                    id: 'controlPanel',
                    class: ['mobile', `${activePanel}-sheet`],
                    headerText: MOBILE_PANEL_TITLES[activePanel],
                    collapsible: false
                },
                this.renderMobilePanel()
            ),
            this.renderMobileDock()
        );
    }

    renderDesktop() {
        const { collapsed } = this.state;
        return jsx(
            'div',
            { style: { display: 'contents' } },
            jsx(
                'div',
                {
                    id: 'desktopPanelStack'
                },
                jsx(
                    Panel,
                    {
                        id: 'controlPanel',
                        class: ['desktop'],
                        resizable: 'top',
                        headerText: 'CONTROLS',
                        collapsible: true,
                        collapsed
                    },
                    this.renderDeviceSelector(),
                    jsx(
                        Container,
                        {
                            id: 'controlPanel-scroll-region'
                        },
                        this.renderControls()
                    )
                )
            )
        );
    }

    render() {
        const { iframePath } = this;
        const { exampleLoaded, loadedPath, loadError } = this.state;
        const error = loadError?.path === iframePath ? loadError : null;
        const loading = !error && (!exampleLoaded || loadedPath !== iframePath);
        const layout = this.props.layout ?? this.state.layout;
        const mobilePanel = layout === 'mobile' ? this.props.mobilePanel : null;
        const className = mobilePanel ? 'mobile-panel-open' : undefined;
        return jsx(
            Container,
            {
                id: 'canvas-container',
                class: className
            },
            (loading || error) && jsx(
                'div',
                {
                    id: 'exampleLoading',
                    className: error ? 'error' : undefined
                },
                jsx(
                    'div',
                    {
                        className: 'example-loading-content'
                    },
                    error ? fragment(
                        jsx('div', { className: 'example-loading-title' }, 'Example failed to load'),
                        jsx('div', { className: 'example-loading-message' }, error.message)
                    ) : fragment(
                        jsx(Spinner, { size: 34 }),
                        jsx('div', { className: 'example-loading-title' }, 'LOADING')
                    )
                )
            ),
            jsx('iframe', {
                id: 'exampleIframe',
                key: iframePath,
                src: iframePath
            }),
            layout !== 'mobile' && this.renderDescription(),
            layout !== 'mobile' && this.renderCreditsOverlay(),
            layout === 'mobile' ? this.renderMobile() : this.renderDesktop()
        );
    }
}

/**
 * @param {Omit<Props, 'match'>} props - Component properties.
 * @returns {ReactElement} The Example component with router params.
 */
function ExampleWithRouter(props) {
    const params = useParams();
    // @ts-ignore
    return jsx(Example, { ...props, match: { params } });
}

export { ExampleWithRouter as Example };
