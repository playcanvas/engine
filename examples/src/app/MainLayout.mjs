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

    componentDidMount() {
        this.onLayoutChange = this.onLayoutChange.bind(this);
        window.addEventListener("resize", this.onLayoutChange);
        window.addEventListener("orientationchange", this.onLayoutChange);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onLayoutChange);
        window.removeEventListener("orientationchange", this.onLayoutChange);
    }

    onLayoutChange() {
        this.setState({ ...this.state, orientation: getOrientation() });
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
