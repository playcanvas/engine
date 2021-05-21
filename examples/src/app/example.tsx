import React, { Component, createRef } from 'react';
import Canvas from './canvas';
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

    // shouldComponentUpdate(nextProps: ExampleProps) {
    //     const getIframePath = (props: ExampleProps) => {
    //         return `/#/iframe${props.path}?files=${btoa(JSON.stringify(props.files))}`;
    //     };
    //     return getIframePath(this.props) !== getIframePath(nextProps);
    // }
    //     const filesHaveChanged = (a: Array<File>, b: Array<File>) => {
    //         if (a && !b) return true;
    //         if (a.length !== b.length) {
    //             return true;
    //         }
    //         for (let i = 0; i < a.length; i++) {
    //             if (a[i].text !== b[i].text) {
    //                 return true;
    //             }
    //         }
    //         return false;
    //     };
    //     return filesHaveChanged(this.props.files, nextProps.files);
    // }

    get files() {
        if (this.props.files.length > 0 && this.props.files[0]?.text?.length > 0) {
            return this.props.files;
        }
        return this.props.defaultFiles;
    }

    get iframePath() {
        return `/#/iframe${this.props.path}?files=${btoa(JSON.stringify(this.files))}`;
    }

    // componentDidUpdate() {
    //     const container = document.getElementById('canvas-container');
    //     if (!container.querySelector('iframe')) {
    //         const iframe = document.createElement('iframe');
    //         iframe.setAttribute('src', this.iframePath);
    //         container.appendChild(iframe);
    //     }
    // }

    // componentWillUnmount() {
    //     // const container = document.getElementById('canvas-container');
    //     // const iframe = container.querySelector('iframe');
    //     // // Pointing iframe to a blank page frees up most of the memory.
    //     // iframe.src = 'about:blank';
    //     // try {
    //     //     iframe.contentWindow.document.write('');
    //     // } catch (e) {}
    //     // // Remove iframe from the page
    //     // iframe.parentNode.removeChild(iframe);
    // }

    render() {
        const path = this.iframePath;
        return <Container id="canvas-container">
            <Spinner size={50}/>
            <iframe key={path} src={path}></iframe>
        </Container>;
    }
}

export default Example;
