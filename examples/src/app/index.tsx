import React, { useEffect, useState, createRef } from 'react';
import ReactDOM from 'react-dom';
import { Container } from '@playcanvas/pcui/react';
import '@playcanvas/pcui/styles';
// @ts-ignore: library file import
import { HashRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import SideBar from './sidebar';
import CodeEditor from './code-editor';
import Menu from './menu';
import Example from './example';

const MainLayout = () => {
    const emptyFiles = [{
        name: 'example.ts',
        text: ''
    }];
    const [files, setFiles] = useState(emptyFiles);
    const [lintErrors, setLintErrors] = useState(false);
    const [useTypeScript, setUseTypeScript] = useState(localStorage.getItem('useTypeScript') === 'true');

    const updateShowMiniStats = (value: boolean) => {
        (window as any)._showMiniStats = value;
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

    return (
        <div id='appInner'>
            <Router>
                <Switch>
                    <Route exact path='/'>
                        <Redirect to="/misc/hello-world" />
                    </Route>
                    <Route path='/:category/:example'>
                        <SideBar/>
                        <Container id='main-view-wrapper'>
                            <Menu useTypeScript={useTypeScript} setShowMiniStats={updateShowMiniStats} />
                            <Container id='main-view'>
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
                            </Container>
                        </Container>
                    </Route>
                </Switch>
            </Router>
        </div>
    );
};

// render out the app
ReactDOM.render(
    <MainLayout />,
    document.getElementById('app')
);
