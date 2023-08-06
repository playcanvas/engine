import React, { useEffect, useState, createRef } from 'react';
import ReactDOM from 'react-dom';
import * as pcui from '@playcanvas/pcui/react';
import '@playcanvas/pcui/styles';
// @ts-ignore: library file import
import { HashRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import { SideBar       } from './sidebar.mjs';
import { CodeEditor    } from './code-editor.mjs';
import { Menu          } from './menu.mjs';
import { Example       } from './example.mjs';
import { ErrorBoundary } from './error-boundary.mjs';
import { jsx           } from '../examples/animation/jsx.mjs';

window.pcui = pcui;
window.React = React;

const MainLayout = () => {
    const emptyFiles = [{
        name: 'example.js',
        text: ''
    }];
    const [files, setFiles] = useState(emptyFiles);
    const [lintErrors, setLintErrors] = useState(false);
    /**
     * @param {boolean} value 
     */
    const updateShowMiniStats = (value) => {
        window._showMiniStats = value;
    };
    const playButtonRef = createRef();
    useEffect(() => {
        if (playButtonRef.current) {
            // @ts-ignore
            playButtonRef.current.element.unbind();
            // @ts-ignore
            playButtonRef.current.element.on('click', () => {
                // @ts-ignore
                document.getElementById('exampleIframe').contentWindow.location.reload();
            });
        }
    });
    return (React.createElement("div", { id: 'appInner' },
        React.createElement(Router, null,
            React.createElement(Switch, null,
                React.createElement(Route, { exact: true, path: '/' },
                    React.createElement(Redirect, { to: "/misc/hello-world" })),
                React.createElement(Route, { path: '/:category/:example' },
                    React.createElement(SideBar, null),
                    React.createElement(pcui.Container, { id: 'main-view-wrapper' },
                        React.createElement(Menu, {
                            setShowMiniStats: updateShowMiniStats
                        }),
                        React.createElement(pcui.Container, { id: 'main-view' },
                            jsx(ErrorBoundary, null,
                                React.createElement(CodeEditor, {
                                    lintErrors,
                                    setLintErrors,
                                    playButtonRef,
                                    files,
                                    setFiles
                                }),
                                React.createElement(Example, {
                                    files,
                                    setFiles,
                                }))))))))
    );
};
// render out the app
ReactDOM.render(
    React.createElement(MainLayout, null),
    document.getElementById('app')
);
