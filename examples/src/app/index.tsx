import React, { useEffect, useState, createRef } from 'react';
import ReactDOM from 'react-dom';
// @ts-ignore: library file import
import { Container } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { HashRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import SideBar from './sidebar';
import CodeEditor from './code-editor';
import ExampleIframe from './example-iframe';
import Menu from './menu';
import { examples } from './helpers/raw-file-loading';
import { File } from './helpers/types';
import './styles.css';

interface ExampleRoutesProps {
    files: Array<File>,
    setDefaultFiles: (files: Array<File>) => void,
    showMiniStats: boolean
}
const ExampleRoutes = (props: ExampleRoutesProps) => {
    return (
        <Switch>
            {
                examples.paths.map((p) => {
                    return <Route key={p.path} path={[p.path, `${p.path}.html`]}>
                        <p.example path={p.path} defaultFiles={p.files} files={props.files} setDefaultFiles={props.setDefaultFiles} showMiniStats={props.showMiniStats} />
                    </Route>;
                })
            }
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
    const [showMiniStats, setShowMiniStats] = useState(false);

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
                    <Route exact path="/">
                        <Redirect to="/misc/hello-world" />
                    </Route>
                    {
                        examples.paths.map((p) => {
                            const e = new p.example();
                            const assetsLoader = e.load;
                            const controls = e.controls;
                            return [
                                <Route key={`/iframe${p.path}`} path={[`/iframe${p.path}`]}>
                                    <ExampleIframe controls={controls} assets={assetsLoader ? assetsLoader().props.children : null} files={p.files} debug={p.path.includes('mini-stats')}/>
                                </Route>,
                                <Route key={`/debug${p.path}`} path={[`/debug${p.path}`]}>
                                    <ExampleIframe controls={controls} assets={assetsLoader ? assetsLoader().props.children : null} files={p.files} debug={p.path.includes('mini-stats')} debugExample={e}/>
                                </Route>
                            ];
                        })
                    }
                    <Route key='main' path={`/`}>
                        <SideBar categories={examples.categories}/>
                        <Container id='main-view-wrapper'>
                            <Menu lintErrors={lintErrors} hasEditedFiles={hasEditedFiles()} playButtonRef={playButtonRef} showMiniStats={showMiniStats} setShowMiniStats={setShowMiniStats} />
                            <Container id='main-view'>
                                <ExampleRoutes files={exampleFiles} setDefaultFiles={updateExample.bind(this)} showMiniStats={showMiniStats} />
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
