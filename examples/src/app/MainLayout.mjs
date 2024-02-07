import { Component } from 'react';
import { HashRouter, Switch, Route, Redirect } from 'react-router-dom';
import { CodeEditor } from './code-editor.mjs';
import { ErrorBoundary } from './error-boundary.mjs';
import { Example } from './example.mjs';
import { iframeHideStats, iframeShowStats } from './iframeUtils.mjs';
import { jsx } from './jsx.mjs';
import { Menu } from './menu.mjs';
import { SideBar } from './sidebar.mjs';
import { getOrientation } from './utils.mjs';
import { Container } from '@playcanvas/pcui/react';

// eslint-disable-next-line jsdoc/require-property
/**
 * @typedef {object} Props
 */

/**
 * @typedef {object} State
 * @property {'portrait'|'landscape'} orientation - Current orientation.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class MainLayout extends TypedComponent {
    /** @type {State} */
    state = {
        orientation: getOrientation()
    };

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._onLayoutChange = this._onLayoutChange.bind(this);
    }

    /**
     * @param {Event} event - The event.
     */
    _onLayoutChange(event) {
        this.setState({ ...this.state, orientation: getOrientation() });
    }

    componentDidMount() {
        window.addEventListener("resize", this._onLayoutChange);
        window.addEventListener("orientationchange", this._onLayoutChange);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this._onLayoutChange);
        window.removeEventListener("orientationchange", this._onLayoutChange);
    }

    /**
     * @param {boolean} value - Show MiniStats state.
     */
    updateShowMiniStats = (value) => {
        if (value) {
            iframeShowStats();
        } else {
            iframeHideStats();
        }
    };

    render() {
        const { orientation } = this.state;
        return jsx(
            "div", { id: 'appInner' },
            jsx(HashRouter, null,
                jsx(Switch, null,
                    jsx(Route, { exact: true, path: '/' },
                        jsx(Redirect, { to: "/misc/hello-world" })),
                    jsx(Route, { path: '/:category/:example' },
                        jsx(SideBar, null),
                        jsx(Container, { id: 'main-view-wrapper' },
                            jsx(Menu, {
                                setShowMiniStats: this.updateShowMiniStats.bind(this)
                            }),
                            jsx(Container, { id: 'main-view' },
                                jsx(ErrorBoundary, null,
                                    orientation === 'landscape' && jsx(CodeEditor),
                                    jsx(Example, null)
                                )
                            )
                        )
                    )
                )
            )
        );
    }
}

export { MainLayout };
