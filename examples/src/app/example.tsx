import React, { Component } from 'react';
import { Container, Spinner } from 'pcui/react';
import { File } from './helpers/types';
import examples from './helpers/example-data.mjs';
// @ts-ignore: library file import
import { withRouter } from 'react-router-dom';
import ControlPanel from './control-panel';

const Controls = (props: any) => {
    const controlsFunction = (examples as any).paths[props.path].example.prototype.controls;
    const controls = controlsFunction ? (examples as any).paths[props.path].example.prototype.controls((window as any).observerData).props.children : null;
    if (!controls) return null;
    return <ControlPanel controls={controls} files={props.files} />;
};
interface ControlLoaderProps {
    path: string,
    files: any
}

interface ControlLoaderState {
    exampleLoaded: boolean
}

class ControlLoader extends Component <ControlLoaderProps, ControlLoaderState> {
    timeout: any;

    constructor(props: ControlLoaderProps) {
        super(props);
        this.state = {
            exampleLoaded: false
        };
        window.addEventListener('exampleLoading', () => {
            this.setState({
                exampleLoaded: false
            });
        });
        window.addEventListener('exampleLoad', () => {
            this.setState({
                exampleLoaded: true
            });
        });
    }

    componentDidUpdate(prevProps: Readonly<ControlLoaderProps>): void {
        if (prevProps.path !== this.props.path) {
            this.setState({
                exampleLoaded: false
            });
        }
    }

    render() {
        return <>
            { this.state.exampleLoaded && <Controls {...this.props} /> }
        </>;
    }
}

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
    editorValue: string;

    componentDidMount() {
        window.localStorage.removeItem(this.path);
        this.props.setFiles(this.defaultFiles);
    }

    shouldComponentUpdate(nextProps: Readonly<ExampleProps>): boolean {
        return this.props.match.params.category !== nextProps.match.params.category || this.props.match.params.example !== nextProps.match.params.example;
    }

    componentDidUpdate() {
        window.localStorage.removeItem(this.path);
        delete (window as any).editedFiles;
        this.props.setFiles(this.defaultFiles);
    }

    get defaultFiles() {
        return (examples as any).paths[this.path].files;
    }

    get path() {
        return `/${this.props.match.params.category}/${this.props.match.params.example}`;
    }

    render() {
        const iframePath = `/iframe${this.path}`;
        return <Container id="canvas-container">
            <Spinner size={50}/>
            <iframe id="exampleIframe" key={iframePath} src={iframePath}></iframe>
            <ControlLoader path={this.path} files={this.props.files} />
        </Container>;
    }
}

export default withRouter(Example);
