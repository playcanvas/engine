import React, { useEffect, useState, createRef } from 'react';
import ReactDOM from 'react-dom';
import * as pcui from '@playcanvas/pcui/react';
import '@playcanvas/pcui/styles';
// @ts-ignore: library file import
import { HashRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import SideBar from './sidebar.mjs';
import CodeEditor from './code-editor.mjs';
import Menu from './menu.mjs';
import Example from './example.mjs';
import { ErrorBoundary } from './error-boundary.mjs';
import { jsx } from '../examples/animation/jsx.mjs';

window.pcui = pcui;
window.React = React;

const MainLayout = () => {
    const emptyFiles = [{
        name: 'example.ts',
        text: ''
    }];
    const [files, setFiles] = useState(emptyFiles);
    const [lintErrors, setLintErrors] = useState(false);
    const [useTypeScript, setUseTypeScript] = useState(localStorage.getItem('useTypeScript') === 'true');
    /**
     * 
     * @param {boolean} value 
     */
    const updateShowMiniStats = (value) => {
        window._showMiniStats = value;
    };

    const playButtonRef = createRef();
    const languageButtonRef = createRef();
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
        if (languageButtonRef.current) {
            // @ts-ignore
            languageButtonRef.current.element.unbind();
            // @ts-ignore
            languageButtonRef.current.element.on('click', () => {
                localStorage.setItem('useTypeScript', !useTypeScript ? 'true' : 'false');
                setUseTypeScript(!useTypeScript);
            });
        }
    });
/*
    return (
        <div id='appInner'>
            <Router>
                <Switch>
                    <Route exact path='/'>
                        <Redirect to="/misc/hello-world" />
                    </Route>
                    <Route path='/:category/:example'>
                        <SideBar/>
                        <pcui.Container id='main-view-wrapper'>
                            <Menu useTypeScript={useTypeScript} setShowMiniStats={updateShowMiniStats} />
                            <pcui.Container id='main-view'>
                                <CodeEditor
                                    lintErrors={lintErrors}
                                    setLintErrors={setLintErrors}
                                    playButtonRef={playButtonRef}
                                    languageButtonRef={languageButtonRef}
                                    useTypeScript={useTypeScript}
                                    files={files}
                                    setFiles={setFiles}
                                />
                                <Example files={files} setFiles={setFiles} useTypeScript={useTypeScript} />
                            </pcui.Container>
                        </pcui.Container>
                    </Route>
                </Switch>
            </Router>
        </div>
    );
*/
return (React.createElement("div", { id: 'appInner' },
    React.createElement(Router, null,
        React.createElement(Switch, null,
            React.createElement(Route, { exact: true, path: '/' },
                React.createElement(Redirect, { to: "/misc/hello-world" })),
            React.createElement(Route, { path: '/:category/:example' },
                React.createElement(SideBar, null),
                React.createElement(pcui.Container, { id: 'main-view-wrapper' },
                    React.createElement(Menu, { useTypeScript: useTypeScript, setShowMiniStats: updateShowMiniStats }),
                    React.createElement(pcui.Container, { id: 'main-view' },
                        jsx(ErrorBoundary, null,
                            React.createElement(CodeEditor, {
                                lintErrors,
                                setLintErrors,
                                playButtonRef,
                                languageButtonRef,
                                useTypeScript,
                                files,
                                setFiles
                            }),
                            React.createElement(Example, {
                                files,
                                setFiles,
                                useTypeScript
                            })))))))));
};
// render out the app
//ReactDOM.render(
//    <MainLayout />,
//    document.getElementById('app')
//);
ReactDOM.render(React.createElement(MainLayout, null), document.getElementById('app'));
