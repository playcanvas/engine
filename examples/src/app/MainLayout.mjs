import { Component } from 'react';
import { HashRouter, Switch, Route, Redirect } from "react-router-dom";
import { SideBar       } from './sidebar.mjs';
import { CodeEditor    } from './code-editor.mjs';
import { Menu          } from './menu.mjs';
import { Example       } from './example.mjs';
import { ErrorBoundary } from './error-boundary.mjs';
import { jsx, jsxContainer           } from './jsx.mjs';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';

/**
 * @returns {'portrait'|'landscape'}
 */
export const getOrientation = () => window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'portrait': 'landscape';

class MainLayout extends Component {
    state = {
        orientation: getOrientation(),
    }

    constructor() {
        super();
        this.onLayoutChange = this.onLayoutChange.bind(this);
    }

    componentDidMount() {
        window.addEventListener("resize", this.onLayoutChange);
        screen.orientation.addEventListener("change", this.onLayoutChange);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onLayoutChange);
        screen.orientation.removeEventListener("change", this.onLayoutChange);
    }

    onLayoutChange() {
        this.setState({ ...this.state, orientation: getOrientation() });
    }

    /**
     * @param {boolean} value 
     */
    updateShowMiniStats = (value) => {
        console.log("updateShowMiniStats");
        window._showMiniStats = value;
    }

    render() {
        const { orientation } = this.state;
        return jsx("div", { id: 'appInner' },
            jsx(HashRouter, null,
                jsx(Switch, null,
                    jsx(Route, { exact: true, path: '/' },
                        jsx(Redirect, { to: "/misc/hello-world" })),
                    jsx(Route, { path: '/:category/:example' },
                        jsx(SideBar, null),
                        jsxContainer({ id: 'main-view-wrapper' },
                            jsx(Menu, {
                                setShowMiniStats: this.updateShowMiniStats.bind(this)
                            }),
                            jsxContainer({ id: 'main-view' },
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
