import React, { useEffect, useState, createRef } from 'react';
import ReactDOM from 'react-dom';
import * as pcui from '@playcanvas/pcui/react';
import { createRoot } from 'react-dom/client';
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
//import * as pc from 'playcanvas';
//import * as pcx from 'playcanvas-extras';
//import * as observer from '@playcanvas/observer';
//console.log("having app now", pc, window);
//window.pc = pc;

Object.assign(window, {
    pcui,
    React,
    //pc,
    //pcx,
    //observer,
});

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
function main() {
    const oldWay = !true;
    console.log("oldWay", oldWay);
    if (oldWay) {    
        // render out the app
        ReactDOM.render(
            jsx(MainLayout, null),
            document.getElementById('app')
        );
    } else {
        // render out the app
        const container = document.getElementById('app');
        const root = createRoot(container);
        root.render(jsx(MainLayout, null));
    }
}
window.onload = () => {
    // Just a little timeout to give browser some time to "breathe"
    setTimeout(main, 50);
};
