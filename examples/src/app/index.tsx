import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
// @ts-ignore: library file import
import { Container, Button } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/pcui/pcui-binding';
// @ts-ignore: library file import
import { HashRouter as Router, Switch, Route, useLocation } from "react-router-dom";
import SideBar from './sidebar';
import CodeEditor from './code-editor';
import { examples } from './helpers/raw-file-loading';
import { File } from './helpers/types';
import './styles.css';

const useQuery = () => {
    return new URLSearchParams(useLocation().search);
};

const ExampleRoutes = (props: { files: Array<File>, setFiles: (value: Array<File>) => void, state: Observer}) => {
    const query = useQuery();
    useEffect(() => {
        if (query.get('fullscreen')) {
            document.getElementById('appInner').classList.add('fullscreen');
        }
    });
    return (
        <Switch>
            {
                examples.paths.map((p) => {
                    return <Route key={p.path} path={p.path}>
                        <p.example edit={query.get('edit')} defaultFiles={p.files} files={props.files} setFiles={props.setFiles} state={props.state} />
                    </Route>;
                })
            }
        </Switch>
    );
};

const MainLayout = () => {
    const [files, setFiles] = useState([{
        name: 'example.ts',
        text: ''
    }]);
    const state: Observer = new Observer({});

    let mouseTimeout: any = null;
    let clickFullscreenListener: EventListener = null;
    return (
        <div id='appInner'>
            <Router>
                <SideBar categories={examples.categories} />
                <Container id='main-view-wrapper'>
                    <Container id='menu'>
                        <img src='https://playcanvas.com/viewer/static/playcanvas-logo.png' />
                        <Button icon='E301' text='' />
                        <Button icon='E236' text='' />
                        <Button icon='E259' text='' onClick={() => {
                            window.open("https://github.com/playcanvas/engine");
                        }}/>
                        <Button icon='E127' text='' id='fullscreen-button' onClick={() => {
                            if (clickFullscreenListener) {
                                document.removeEventListener('mousemove', clickFullscreenListener);
                            }
                            document.querySelector('#canvas-container').classList.toggle('fullscreen');
                            const app = document.querySelector('#appInner');
                            app.classList.toggle('fullscreen');
                            if (app.classList.contains('fullscreen')) {
                                clickFullscreenListener = () => {
                                    app.classList.add('active');
                                    if (mouseTimeout) {
                                        window.clearTimeout(mouseTimeout);
                                    }
                                    mouseTimeout = setTimeout(() => {
                                        app.classList.remove('active');
                                    }, 2000);
                                };
                                document.addEventListener('mousemove', clickFullscreenListener);
                            }
                        }}/>
                        <Button icon='E131' text='' onClick={() => {
                            state.emit('play');
                        }}/>
                    </Container>
                    <Container id='main-view'>
                        <ExampleRoutes files={files} setFiles={setFiles.bind(this)} state={state} />
                        <CodeEditor files={files} setFiles={setFiles.bind(this)} />
                    </Container>
                </Container>
            </Router>
        </div>
    );
};

// render out the app
ReactDOM.render(
    <MainLayout />,
    document.getElementById('app')
);
