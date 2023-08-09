import React, { Component } from 'react';
import { useParams, withRouter } from 'react-router-dom';
import { Container, Spinner, SelectInput, Panel } from '@playcanvas/pcui/react';
import { SelectInput as SelectInputClass } from '@playcanvas/pcui';
import { Observer } from '@playcanvas/observer';
//import { File } from './helpers/types';
import examples from './helpers/example-data.mjs';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { iframePath } from '../assetPath.mjs';
import { jsx, jsxContainer, jsxPanel, jsxSelectInput, jsxSpinner } from '../examples/animation/jsx.mjs';
import { DeviceSelector } from './device-selector.mjs';

const controlsObserver = new Observer();

/**
 * @typedef {object} ExampleProps
 * @property {Array<File>} files
 * @property {(value: Array<File>) => void} setFiles
 * @property {{params: any}} match
 */

/**
 * @typedef {object} ExampleState
 * @property {any} codeError
 */

/** @type {typeof Component<ExampleProps, ExampleState>} */
const c = Component;

class Example extends c {
    /** @type {string} */
    editorValue;
    /**
     * @param {ExampleProps} props 
     */
    constructor(props) {
        super(props);
        //controlsObserver.on('updateActiveDevice', this.onSetActiveGraphicsDevice);
        controlsObserver.on('updateActiveDevice', () => console.warn("todo turn into prop"));
    }

    get defaultFiles() {
        return examples.paths[this.path].files;
    }

    get path() {
        return `/${this.props.match.params.category}/${this.props.match.params.example}`;
    }

    get iframePath() {
        const example = examples.paths[this.path];
        // E.g. "http://127.0.0.1/playcanvas-engine/examples/src/iframe/?category=Misc&example=MiniStats"
        return `${iframePath}?category=${example.category}&example=${example.name}`;
    }

    componentDidMount() {
        window.localStorage.removeItem(this.path);
        this.props.setFiles(this.defaultFiles);
    }
    /**
     * @param {Readonly<ExampleProps>} nextProps 
     * @returns {boolean}
     */
    shouldComponentUpdate(nextProps) {
        const updateMobileOnFileChange = () => {
            return window.top.innerWidth < MIN_DESKTOP_WIDTH && this.props.files !== nextProps.files;
        };
        return this.props.match.params.category !== nextProps.match.params.category || this.props.match.params.example !== nextProps.match.params.example || updateMobileOnFileChange();
    }

    componentDidUpdate() {
        window.localStorage.removeItem(this.path);
        delete window.editedFiles;
        this.props.setFiles(this.defaultFiles);
    }

    onSetPreferredGraphicsDevice(value) {
        // reload the iframe after updating the device
        /** @type {HTMLIFrameElement} */
        const exampleIframe = document.getElementById('exampleIframe');
        exampleIframe.contentWindow.location.reload();
    }

    render() {
        const iframePath = this.iframePath;
        const children = this.props.children;
        return jsxContainer(
            {
                id: "canvas-container"
            },
            jsxSpinner({ size: 50 }),
            jsx("iframe", {
                id: "exampleIframe",
                key: iframePath,
                src: iframePath
            }),
            jsxPanel(
                {
                    id: 'controlPanel',
                    class: [window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'mobile' : null],
                    resizable: 'top',
                    headerText: window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'CODE & CONTROLS' : 'CONTROLS',
                    collapsible: true,
                    collapsed: window.top.innerWidth < MIN_DESKTOP_WIDTH
                },
                jsx(DeviceSelector, {onSelect: this.onSetPreferredGraphicsDevice}),
                children,
            )
        );       
    }
}
const ExamptWithRouter = withRouter(Example);
export {
    ExamptWithRouter as Example,
    controlsObserver,
};
