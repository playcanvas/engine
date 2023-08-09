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
import { jsx, jsxContainer           } from '../examples/animation/jsx.mjs';
import { ControlLoader } from './control-loader.mjs';

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
    return (
        jsx("div", { id: 'appInner' },
            jsx(Router, null,
                jsx(Switch, null,
                    jsx(Route, { exact: true, path: '/' },
                        jsx(Redirect, { to: "/misc/hello-world" })),
                    jsx(Route, { path: '/:category/:example' },
                        jsx(SideBar, null),
                        jsxContainer({ id: 'main-view-wrapper' },
                            jsx(Menu, {
                                setShowMiniStats: updateShowMiniStats
                            }),
                            jsxContainer({ id: 'main-view' },
                                jsx(ErrorBoundary, null,
                                    jsx(CodeEditor, {
                                        lintErrors,
                                        setLintErrors,
                                        playButtonRef,
                                        files,
                                        setFiles
                                    }),
                                    jsx(
                                        Example,
                                        {
                                            files,
                                            setFiles,
                                        },
                                        jsx(ControlLoader, { /*path: this.path,*/ files, setFiles })
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};
// render out the app
ReactDOM.render(
    jsx(MainLayout, null),
    document.getElementById('app')
);
