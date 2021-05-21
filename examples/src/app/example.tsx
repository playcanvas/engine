import React, { Component } from 'react';
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
        return `/#/iframe${this.props.path}?files=${btoa(JSON.stringify(this.files))}`;
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
