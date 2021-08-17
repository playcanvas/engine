import React, { useEffect, useState, createRef } from 'react';
import ReactDOM from 'react-dom';
// @ts-ignore: library file import
import { Container } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { HashRouter as Router, Switch, Route } from "react-router-dom";
import SideBar from './sidebar';
import CodeEditor from './code-editor';
import ExampleIframe from './example-iframe';
import Menu from './menu';
import { examples } from './helpers/raw-file-loading';
import { File } from './helpers/types';
import './styles.css';

interface ExampleRoutesProps {
    files: Array<File>,
    setDefaultFiles: (files: Array<File>) => void
}
const ExampleRoutes = (props: ExampleRoutesProps) => {
    const defaultExample = examples.paths['/misc/hello-world'];
    return (
        <Switch>
            {
                Object.values(examples.paths).map((p) => {
                    return <Route key={p.path} path={[p.path, `${p.path}.html`]}>
                        <p.example path={p.path} defaultFiles={p.files} files={props.files} setDefaultFiles={props.setDefaultFiles} />
                    </Route>;
                })
            }
            <Route path='/'>
                <defaultExample.example path={defaultExample.path} defaultFiles={defaultExample.files} files={props.files} setDefaultFiles={props.setDefaultFiles} />
            </Route>
        </Switch>
    );
};


const filesHaveChanged = (a: Array<File>, b: Array<File>) => {
    if (a && !b) return true;
    if (a.length !== b.length) {
        return true;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i].text !== b[i].text) {
            return true;
        }
    }
    return false;
};

const MainLayout = () => {
    const emptyFiles = [{
        name: 'example.ts',
        text: ''
    }];
    // The defaults files are the collection of example files created by an example author. When loading up a new example page, that examples files will be set here
    const [defaultFiles, setDefaultFiles] = useState(emptyFiles);
    // The edited files contains any edits to the default files that have been made by the user
    const [editedFiles, setEditedFiles] = useState(emptyFiles);
    // The example files are the files that should be loaded and executed by the example. Upon hitting the play button, the currently set edited files are set to the example files
    const [exampleFiles, setExampleFiles] = useState(emptyFiles);
    const [lintErrors, setLintErrors] = useState(false);

    const updateShowMiniStats = (value: boolean) => {
        (window as any)._showMiniStats = value;
    };

    const playButtonRef = createRef();
    useEffect(() => {
        if (playButtonRef.current) {
            // @ts-ignore
            playButtonRef.current.element.unbind();
            // @ts-ignore
            playButtonRef.current.element.on('click', () => {
                setExampleFiles(editedFiles);
            });
        }
    });

    const updateExample = (newExampleDefaultFiles: Array<File>) => {
        setDefaultFiles(newExampleDefaultFiles);
        setEditedFiles(emptyFiles);
        setExampleFiles(emptyFiles);
    };

    const hasEditedFiles = () => {
        if (exampleFiles[0].text.length === 0) {
            return filesHaveChanged(defaultFiles, editedFiles);
        }
        return filesHaveChanged(editedFiles, exampleFiles);
    };

    return (
        <div id='appInner'>
            <Router>
                <Switch>
                    {
                        Object.values(examples.paths).map((p) => {
                            const e = new p.example();
                            const assetsLoader = e.load;
                            const controls = e.controls;
                            return [
                                <Route key={`/iframe${p.path}`} path={[`/iframe${p.path}`]}>
                                    <ExampleIframe controls={controls} assets={assetsLoader ? assetsLoader().props.children : null} engine={e.constructor.ENGINE} files={p.files} />
                                </Route>,
                                <Route key={`/debug${p.path}`} path={[`/debug${p.path}`]}>
                                    <ExampleIframe controls={controls} assets={assetsLoader ? assetsLoader().props.children : null}  engine={e.constructor.ENGINE} files={p.files} debugExample={e}/>
                                </Route>
                            ];
                        })
                    }
                    <Route key='main' path='/'>
                        <SideBar categories={examples.categories}/>
                        <Container id='main-view-wrapper'>
                            <Menu lintErrors={lintErrors} hasEditedFiles={hasEditedFiles()} playButtonRef={playButtonRef} setShowMiniStats={updateShowMiniStats} />
                            <Container id='main-view'>
                                <ExampleRoutes files={exampleFiles} setDefaultFiles={updateExample.bind(this)} />
                                <CodeEditor files={editedFiles[0].text.length > 0 ? editedFiles : defaultFiles} setFiles={setEditedFiles.bind(this)} setLintErrors={setLintErrors} />
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
