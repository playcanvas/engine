import { Container } from '@playcanvas/pcui/react';
import { Component } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import { CodeEditorDesktop } from './code-editor/CodeEditorDesktop.mjs';
import { Example } from './Example.mjs';
import { Menu } from './Menu.mjs';
import { SideBar } from './Sidebar.mjs';
import { iframe } from '../iframe.mjs';
import { jsx } from '../jsx.mjs';
import { getLayout } from '../utils.mjs';

const MOBILE_DOCK_HEIGHT = 48;
const MOBILE_DOCK_WIDTH = 48;
const MOBILE_GAP = 8;
const MOBILE_PANEL_MIN_HEIGHT = 220;
const MOBILE_PANEL_DEFAULT_MIN_HEIGHT = 300;
const MOBILE_PANEL_DEFAULT_MAX_HEIGHT = 440;
const MOBILE_PANEL_DEFAULT_SCALE = 0.48;
const MOBILE_CANVAS_MIN_HEIGHT = 160;
const MOBILE_PANEL_MIN_WIDTH = 280;
const MOBILE_PANEL_DEFAULT_MIN_WIDTH = 320;
const MOBILE_PANEL_DEFAULT_MAX_WIDTH = 420;
const MOBILE_PANEL_DEFAULT_WIDTH_SCALE = 0.42;
const MOBILE_CANVAS_MIN_WIDTH = 300;

const getMobileOrientation = () => {
    const win = window.top ?? window;
    return win.innerWidth > win.innerHeight ? 'landscape' : 'portrait';
};

function getMobilePanelHeight(height = window.innerHeight * MOBILE_PANEL_DEFAULT_SCALE) {
    const max = Math.max(
        0,
        window.innerHeight - MOBILE_DOCK_HEIGHT - MOBILE_CANVAS_MIN_HEIGHT - MOBILE_GAP * 4
    );
    const min = Math.min(MOBILE_PANEL_MIN_HEIGHT, max);
    return Math.min(max, Math.max(min, height));
}

function getDefaultMobilePanelHeight() {
    return getMobilePanelHeight(Math.min(
        MOBILE_PANEL_DEFAULT_MAX_HEIGHT,
        Math.max(MOBILE_PANEL_DEFAULT_MIN_HEIGHT, window.innerHeight * MOBILE_PANEL_DEFAULT_SCALE)
    ));
}

function getMobilePanelWidth(width = window.innerWidth * MOBILE_PANEL_DEFAULT_WIDTH_SCALE) {
    const max = Math.max(0, window.innerWidth - MOBILE_CANVAS_MIN_WIDTH - MOBILE_DOCK_WIDTH - MOBILE_GAP * 4);
    const min = Math.min(MOBILE_PANEL_MIN_WIDTH, max);
    return Math.min(max, Math.max(min, width));
}

function getDefaultMobilePanelWidth() {
    return getMobilePanelWidth(Math.min(
        MOBILE_PANEL_DEFAULT_MAX_WIDTH,
        Math.max(MOBILE_PANEL_DEFAULT_MIN_WIDTH, window.innerWidth * MOBILE_PANEL_DEFAULT_WIDTH_SCALE)
    ));
}

// eslint-disable-next-line jsdoc/require-property
/**
 * @typedef {object} Props
 */

/**
 * @typedef {object} State
 * @property {'mobile'|'desktop'} layout - Current layout.
 * @property {'portrait'|'landscape'} mobileOrientation - Current mobile orientation.
 * @property {null|'examples'|'code'|'controls'|'description'} mobilePanel - Active mobile panel.
 * @property {number} mobilePanelHeight - Active mobile panel height.
 * @property {number} mobilePanelWidth - Active mobile panel width.
 * @property {boolean} showCredits - Whether the desktop credits overlay is visible.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class MainLayout extends TypedComponent {
    /** @type {State} */
    state = {
        layout: getLayout(),
        mobileOrientation: getMobileOrientation(),
        mobilePanel: null,
        mobilePanelHeight: getDefaultMobilePanelHeight(),
        mobilePanelWidth: getDefaultMobilePanelWidth(),
        showCredits: localStorage.getItem('showCredits') !== 'false'
    };

    /** @type {{ axis: 'x'|'y', position: number, size: number } | null} */
    _mobilePanelDrag = null;

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._onLayoutChange = this._onLayoutChange.bind(this);
    }

    _onLayoutChange() {
        const layout = getLayout();
        this.setState(prevState => ({
            layout,
            mobileOrientation: getMobileOrientation(),
            mobilePanel: layout === 'mobile' ? prevState.mobilePanel : null,
            mobilePanelHeight: getMobilePanelHeight(prevState.mobilePanelHeight),
            mobilePanelWidth: getMobilePanelWidth(prevState.mobilePanelWidth)
        }), this.resizeIframe);
    }

    resizeIframe = () => {
        requestAnimationFrame(() => iframe.window?.dispatchEvent(new Event('resize')));
    };

    /**
     * @param {State['mobilePanel']} mobilePanel - Active mobile panel.
     */
    setMobilePanel = (mobilePanel) => {
        this.setState(prevState => ({
            mobilePanel: prevState.mobilePanel === mobilePanel ? null : mobilePanel
        }), this.resizeIframe);
    };

    /**
     * @param {number} height - Mobile panel height.
     */
    setMobilePanelHeight = (height) => {
        this.setState({ mobilePanelHeight: getMobilePanelHeight(height) }, this.resizeIframe);
    };

    /**
     * @param {number} width - Mobile panel width.
     */
    setMobilePanelWidth = (width) => {
        this.setState({ mobilePanelWidth: getMobilePanelWidth(width) }, this.resizeIframe);
    };

    /**
     * @param {PointerEvent} event - Pointer event.
     */
    onMobilePanelDrag = (event) => {
        if (!this._mobilePanelDrag) {
            return;
        }
        const { axis, position, size } = this._mobilePanelDrag;
        if (axis === 'x') {
            this.setMobilePanelWidth(size + position - event.clientX);
            return;
        }
        this.setMobilePanelHeight(size + position - event.clientY);
    };

    stopMobilePanelDrag = () => {
        this._mobilePanelDrag = null;
        document.body.classList.remove('mobile-panel-resizing');
        document.body.classList.remove('mobile-panel-resizing-x');
        document.body.classList.remove('mobile-panel-resizing-y');
        window.removeEventListener('pointermove', this.onMobilePanelDrag);
        window.removeEventListener('pointerup', this.stopMobilePanelDrag);
        window.removeEventListener('pointercancel', this.stopMobilePanelDrag);
    };

    /**
     * @param {PointerEvent | import('react').PointerEvent<HTMLElement>} event - Pointer event.
     */
    startMobilePanelDrag = (event) => {
        const target = /** @type {HTMLElement | null} */ (event.currentTarget);
        if (!target) {
            return;
        }

        const rect = target.getBoundingClientRect();
        const style = getComputedStyle(target);
        const hitWidth = parseFloat(style.getPropertyValue('--mobile-handle-hit-width')) || 96;
        const hitHeight = parseFloat(style.getPropertyValue('--mobile-handle-hit-height')) || 44;
        const axis = this.state.mobileOrientation === 'landscape' ? 'x' : 'y';
        const x = axis === 'x' ? event.clientX - rect.left : event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top;
        const outside = axis === 'x' ?
            Math.abs(x) > hitHeight / 2 :
            Math.abs(x) > hitWidth / 2 || Math.abs(y) > hitHeight / 2;
        if (outside) {
            return;
        }

        event.preventDefault();
        target.setPointerCapture?.(event.pointerId);
        this._mobilePanelDrag = {
            axis,
            position: axis === 'x' ? event.clientX : event.clientY,
            size: axis === 'x' ? this.state.mobilePanelWidth : this.state.mobilePanelHeight
        };
        document.body.classList.add('mobile-panel-resizing');
        document.body.classList.add(`mobile-panel-resizing-${axis}`);
        window.addEventListener('pointermove', this.onMobilePanelDrag);
        window.addEventListener('pointerup', this.stopMobilePanelDrag);
        window.addEventListener('pointercancel', this.stopMobilePanelDrag);
    };

    componentDidMount() {
        window.addEventListener('resize', this._onLayoutChange);
        window.addEventListener('orientationchange', this._onLayoutChange);
    }

    componentWillUnmount() {
        this.stopMobilePanelDrag();
        window.removeEventListener('resize', this._onLayoutChange);
        window.removeEventListener('orientationchange', this._onLayoutChange);
    }

    /**
     * @param {boolean} value - Show MiniStats state.
     */
    updateShowMiniStats = (value) => {
        iframe.fire('stats', { state: value });
    };

    /**
     * @param {boolean} value - Show credits state.
     */
    setShowCredits = (value) => {
        localStorage.setItem('showCredits', `${value}`);
        this.setState({ showCredits: value });
    };

    render() {
        const { layout, mobileOrientation, mobilePanel, mobilePanelHeight, mobilePanelWidth, showCredits } = this.state;
        return jsx(
            'div',
            {
                id: 'appInner',
                className: layout === 'mobile' ? `mobile mobile-${mobileOrientation}` : 'desktop',
                style: {
                    '--mobile-panel-height': `${mobilePanelHeight}px`,
                    '--mobile-panel-width': `${mobilePanelWidth}px`
                }
            },
            jsx(
                HashRouter,
                null,
                jsx(
                    Routes,
                    null,
                    jsx(Route, {
                        path: '/',
                        element: jsx(Navigate, { to: '/misc/hello-world', replace: true })
                    }),
                    jsx(Route, {
                        path: '/:category/:example',
                        element: jsx(
                            'div',
                            { id: 'appInner-router', style: { display: 'contents' } },
                            jsx(SideBar, {
                                layout,
                                mobilePanel,
                                setMobilePanel: this.setMobilePanel,
                                onMobilePanelDragStart: this.startMobilePanelDrag
                            }),
                            jsx(
                                Container,
                                { id: 'main-view-wrapper' },
                                jsx(Menu, {
                                    layout,
                                    setShowMiniStats: this.updateShowMiniStats.bind(this),
                                    showCredits,
                                    setShowCredits: this.setShowCredits
                                }),
                                jsx(
                                    Container,
                                    { id: 'main-view' },
                                    layout === 'desktop' && jsx(CodeEditorDesktop),
                                    jsx(Example, {
                                        layout,
                                        mobilePanel,
                                        setMobilePanel: this.setMobilePanel,
                                        showCredits,
                                        onMobilePanelDragStart: this.startMobilePanelDrag
                                    })
                                )
                            )
                        )
                    })
                )
            )
        );
    }
}

export { MainLayout };
