import React, { Component } from 'react';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/observer';
// @ts-ignore: library file import
import Container from '@playcanvas/pcui/Container/component';
// @ts-ignore: library file import
import Spinner from '@playcanvas/pcui/Spinner/component';
import { File } from './helpers/types';
import examples from './helpers/example-data';
// @ts-ignore: library file import
import { withRouter } from 'react-router-dom';
import ControlPanel from './control-panel';

interface ExampleProps {
    files: Array<File>,
    setFiles: (value: Array<File>) => void,
    useTypeScript: boolean,
    match: {
        params: any
    },
}

interface ExampleState {
    codeError: any
}

class Example extends Component <ExampleProps, ExampleState> {
    exampleData: Observer;
    editorValue: string;

    constructor(props: ExampleProps) {
        super(props);
        this.exampleData = new Observer();
        (window as any).observerData = this.exampleData;
    }

    componentDidMount() {
        window.localStorage.removeItem(this.path);
        this.props.setFiles(this.defaultFiles);
    }

    componentDidUpdate(prevProps: Readonly<ExampleProps>) {
        if (this.props.match.params.category !== prevProps.match.params.category || this.props.match.params.example !== prevProps.match.params.example) {
            window.localStorage.removeItem(this.path);
            this.props.setFiles(this.defaultFiles);
        }
    }

    get defaultFiles() {
        return examples.paths[this.path].files;
    }

    get path() {
        return `/${this.props.match.params.category}/${this.props.match.params.example}`;
    }

    get controls() {
        if (examples.paths[this.path].example.prototype.controls) {
            return examples.paths[this.path].example.prototype.controls(this.exampleData).props.children;
        }
        return null;
    }

    render() {
        const iframePath = `/iframe${this.path}`;
        return <Container id="canvas-container">
            <Spinner size={50}/>
            <iframe id="exampleIframe" key={iframePath} src={iframePath}></iframe>
            { this.controls && <ControlPanel controls={this.controls} files={this.props.files} /> }
        </Container>;
    }
}

export default withRouter(Example);
