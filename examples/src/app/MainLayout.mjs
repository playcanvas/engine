import { useEffect, useState, createRef } from 'react';
// @ts-ignore: library file import
import { HashRouter, Switch, Route, Redirect } from "react-router-dom";
import { SideBar       } from './sidebar.mjs';
import { CodeEditor    } from './code-editor.mjs';
import { Menu          } from './menu.mjs';
import { Example       } from './example.mjs';
import { ErrorBoundary } from './error-boundary.mjs';
import { jsx, jsxContainer           } from './jsx.mjs';
import { ControlLoader } from './control-loader.mjs';

const MainLayout = () => {
    const [lintErrors, setLintErrors] = useState(false);
    //const [counter, setCounter] = useState(0);
    /**
     * @param {boolean} value 
     */
    const updateShowMiniStats = (value) => {
        window._showMiniStats = value;
    };
    const playButtonRef = createRef();

    //window.addEventListener('exampleLoading', (e) => {
    //    console.log("exampleLoading in MainLayout COUNTER=", counter);
    //    setCounter(counter + 1);
    //});

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
            jsx(HashRouter, null,
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
                                    }),
                                    jsx(Example, null,
                                        jsx(ControlLoader, {
                                            //path: this.props.path,
                                            //files,
                                            //setFiles: (files) => { console.log('ControlLoader#setFiles', files); setFiles(files); },
                                            //setFiles,
                                            //key: Math.random(),
                                        })
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

export { MainLayout };
