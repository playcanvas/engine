import React, { Component } from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/pcui/pcui-binding';
// @ts-ignore: library file import
import { Container, Spinner } from '@playcanvas/pcui/pcui-react';
import { File } from './helpers/types';

interface ExampleProps {
    files: Array<File>,
    defaultFiles: Array<File>,
    setDefaultFiles: (value: Array<File>) => void,
    path: string
}

interface ExampleState {
    codeError: any
}

class Example extends Component <ExampleProps, ExampleState> {
    exampleData: Observer;
    controls: any;
    editorValue: string;

    constructor(props: ExampleProps) {
        super(props);
        this.exampleData = new Observer({});
    }

    // this init method is used to patch the PlayCanvas application so that is loads in any example assets after it is created
    init(assets: pc.Asset[]) {
        // make a copy of the actual PlayCanvas application
        const pcApplication = pc.Application;
        // create a wrapper for the application which adds assets to the created app instance
        const Application = (canvas: HTMLCanvasElement, options: any) => {
            const playcanvasApp = new pcApplication(canvas, options);
            this.addAssets(playcanvasApp, assets);
            // @ts-ignore
            return playcanvasApp;
        };
        // @ts-ignore replace the pc Application with the wrapper
        pc.Application = Application;
        // set the getApplication method
        pc.Application.getApplication = pcApplication.getApplication;
    }

    componentDidMount() {
        this.props.setDefaultFiles(this.props.defaultFiles);
    }

    get files() {
        if (this.props.files.length > 0 && this.props.files[0]?.text?.length > 0) {
            return this.props.files;
        }
        return this.props.defaultFiles;
    }

    get iframePath() {
        return `/#/iframe${this.props.path}?files=${btoa(encodeURIComponent(JSON.stringify(this.files)))}`;
    }

    addAssets(app: pc.Application, assets?: any) {
        Object.keys(window).forEach((scriptKey: any) => {
            const script = window[scriptKey];
            // @ts-ignore
            if (script?.prototype?.constructor?.name === 'scriptType') {
                if (!app.scripts.get(`${scriptKey.substring(0, 1).toLowerCase()}${scriptKey.substring(1)}`)) {
                    // @ts-ignore
                    app.scripts.add(script);
                }
            }
        });
        if (assets) {
            Object.values(assets).forEach((a: any) => {
                app.assets.add(a);
            });
        }
    }


    render() {
        const path = this.iframePath;
        return <Container id="canvas-container">
            <Spinner size={50}/>
            <iframe key={path} src={path}></iframe>
        </Container>;
    }
}

export default Example;
