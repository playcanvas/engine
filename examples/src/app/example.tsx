import React, { Component, createRef } from 'react';
import Canvas from './canvas';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/pcui/pcui-binding';
// @ts-ignore: library file import
import { Container } from '@playcanvas/pcui/pcui-react';
import { Application } from 'playcanvas';
// @ts-ignore: library file import
import * as javascriptErrorOverlay from '../../lib/javascriptErrorOverlay';
// @ts-ignore: library file import
import * as Babel from '@babel/standalone';
import { File } from './helpers/types';

interface ExampleProps {
    files: Array<File>,
    defaultFiles: Array<File>,
    setFiles: (value: Array<File>) => void,
    state: Observer
}

interface ExampleState {
    codeError: any
}

class Example extends Component <ExampleProps, ExampleState> {
    editableCode: (app: Application, assetManifest: any, exampleData: Observer) => void;
    exampleData: Observer;
    controls: any;
    editorValue: string;
    canvasContainerRef: { current?: { element: { class: { add: (value: string) => void, remove: (value: string) => void } } } };

    constructor(props: ExampleProps) {
        super(props);
        this.exampleData = new Observer({});
        if (!props) return;
        this.state = {
            codeError: null
        };
        this.canvasContainerRef = createRef();
    }

    setCodeError(e: any) {
        this.setState({
            codeError: e
        });
    }

    componentDidMount() {
        const files = [...this.props.defaultFiles];
        // @ts-ignore
        if (this.load) {
            // @ts-ignore
            let children = this.load().props.children;
            if (!Array.isArray(children)) {
                children = [children];
            }
            children.forEach((child: any) => {
                if (child.props.type === 'shader') {
                    files.push({
                        name: child.props.name,
                        text: child.props.data,
                        type: 'shader'
                    });
                } else if (child.props.type === 'json') {
                    files.push({
                        name: child.props.name,
                        text: JSON.stringify(child.props.data, null, 4),
                        type: 'json'
                    });
                }
            });
        }
        this.props.setFiles(files);
    }

    executableExample() {
        let editableString;
        if (this.props.files.length > 0) {
            editableString = this.props.files[0].text;
        } else {
            editableString = '';
        }

        // strip the function closure
        editableString = editableString.substring(editableString.indexOf("\n") + 1);
        editableString = editableString.substring(editableString.lastIndexOf("\n") + 1, -1);
        // transform the code using babel
        let transformedCode = Babel.transform(editableString, { filename: `transformedCode.tsx`, presets: ["typescript"] }).code;
        // strip the PlayCanvas app initialisation
        const indexOfAppCallStart = transformedCode.indexOf('const app');
        const indexOfAppCallEnd = indexOfAppCallStart + transformedCode.substring(indexOfAppCallStart, transformedCode.length - 1).indexOf(';');
        const appCall = transformedCode.substring(indexOfAppCallStart, indexOfAppCallEnd + 1);
        transformedCode = transformedCode.replace(appCall, '');

        // @ts-ignore: abstract class function
        return Function('pc', 'app', 'assets', 'data', transformedCode);
    }

    shouldComponentUpdate(nextProps: ExampleProps) {
        let fileChanged = false;
        if (nextProps.files.length !== this.props.files.length) {
            fileChanged = true;
        }
        if (!fileChanged && nextProps.files && nextProps.files.length > 0) {
            for (let i = 0; i < nextProps.files.length; i++) {
                if (this.props.files.length > i && this.props.files[i].text !== nextProps.files[i].text || this.props.files.length < i + 1) {
                    fileChanged = true;
                }
            }
        }
        if (!fileChanged) {
            return false;
        }
        return true;
    }

    render() {
        if (this.canvasContainerRef.current) {
            if (this.state.codeError) {
                this.canvasContainerRef.current.element.class.add('error');
            } else {
                this.canvasContainerRef.current.element.class.remove('error');
            }
        }

        // @ts-ignore
        const overlay = <javascriptErrorOverlay.default.RuntimeError
            errorRecord={this.state.codeError}
            editorHandler={null}
        />;
        return <Container ref={this.canvasContainerRef} id="canvas-container" class={[this.state.codeError !== null ? ['error'] : null]}>
            { <Canvas files={this.props.files} setCodeError={this.setCodeError.bind(this)} exampleData={this.exampleData} executableExample={this.executableExample()}
                controls={this.controls ? this.controls(this.exampleData).props.children : null }
                state={this.props.state}>
                {
                    // @ts-ignore: abstract class function
                    this.load && this.load().props.children
                }
            </Canvas>
            }
            {
                this.state.codeError && <Container id='errorContainer'>
                    { overlay }
                </Container>
            }
        </Container>;
    }
}

export default Example;
