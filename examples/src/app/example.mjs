import React, { Component } from 'react';
import { useParams, withRouter } from 'react-router-dom';
import { Container, Spinner, SelectInput, Panel } from '@playcanvas/pcui/react';
import { SelectInput as SelectInputClass } from '@playcanvas/pcui';
import { Observer } from '@playcanvas/observer';
import { DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU } from 'playcanvas';
//import { File } from './helpers/types';
import examples from './helpers/example-data.mjs';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { iframePath } from '../assetPath.mjs';
import { ControlLoader } from './control-loader.mjs';

const deviceTypeNames = {
    [DEVICETYPE_WEBGL1]: 'WebGL 1',
    [DEVICETYPE_WEBGL2]: 'WebGL 2',
    [DEVICETYPE_WEBGPU]: 'WebGPU'
};

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

/**
 * @extends Component <ExampleProps, ExampleState>
 */
class Example extends Component {
    instance;
    /** @type {string} */
    editorValue;
    deviceTypeSelectInputRef;
    /**
     * @param {ExampleProps} props 
     */
    constructor(props) {
        super(props);
        Example.instance = this;
        this.deviceTypeSelectInputRef = React.createRef();

        controlsObserver.on('updateActiveDevice', this.onSetActiveGraphicsDevice);
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

    /**
     * @type {SelectInput|undefined}
     */
    get deviceTypeSelectInput() {
        return this.deviceTypeSelectInputRef.current?.element;
    }

    /**
     * @type {string}
     */
    set preferredGraphicsDevice(value) {
        window.preferredGraphicsDevice = value;
    }

    get preferredGraphicsDevice() {
        return window.preferredGraphicsDevice;
    }

    /**
     * @param {string} preferredDevice 
     * @param {string} activeDevice 
     */
    setDisabledOptions = (preferredDevice = 'webgpu', activeDevice) => {
        const selectInput = this.deviceTypeSelectInput;
        if ((preferredDevice === DEVICETYPE_WEBGL2 || preferredDevice === DEVICETYPE_WEBGPU) && activeDevice === DEVICETYPE_WEBGL1) {
            selectInput.fallbackOrder = [DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1];
            selectInput.disabledOptions = {
                [DEVICETYPE_WEBGPU]: 'WebGPU (not supported)',
                [DEVICETYPE_WEBGL2]: 'WebGL 2 (not supported)'
            };
        } else if (preferredDevice === DEVICETYPE_WEBGL1 && activeDevice === DEVICETYPE_WEBGL2) {
            selectInput.fallbackOrder = [DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU];
            selectInput.disabledOptions = {
                [DEVICETYPE_WEBGL1]: 'WebGL 1 (not supported)'
            };
        } else if (preferredDevice === DEVICETYPE_WEBGPU && activeDevice !== DEVICETYPE_WEBGPU) {
            selectInput.fallbackOrder = [DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1];
            selectInput.disabledOptions = {
                [DEVICETYPE_WEBGPU]: 'WebGPU (not supported)'
            };
        } else {
            selectInput.disabledOptions = null;
        }
    };

    /**
     * @param {string} value 
     */
    onSetActiveGraphicsDevice = (value) => {
        if (!this.preferredGraphicsDevice) {
            this.preferredGraphicsDevice = value;
            this.deviceTypeSelectInput.value = value;
        }
        this.setDisabledOptions(this.preferredGraphicsDevice, value);
        document.getElementById('showMiniStatsButton').ui.enabled = value !== DEVICETYPE_WEBGPU;
    };

    /**
     * @param {string} value 
     */
    onSetPreferredGraphicsDevice = (value) => {
        this.deviceTypeSelectInput.disabledOptions = null;
        this.deviceTypeSelectInput.value = value;
        this.preferredGraphicsDevice = value;
        // reload the iframe after updating the device
        /** @type {HTMLIFrameElement} */
        const exampleIframe = document.getElementById('exampleIframe');
        exampleIframe.contentWindow.location.reload();
    };

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

    render() {
        const iframePath = this.iframePath;
        return React.createElement(Container, { id: "canvas-container" },
        React.createElement(Spinner, { size: 50 }),
        React.createElement("iframe", {
            id: "exampleIframe",
            key: iframePath,
            src: iframePath
        }),
        React.createElement(Panel, {
            id: 'controlPanel',
            class: [window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'mobile' : null],
            resizable: 'top',
            headerText: window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'CODE & CONTROLS' : 'CONTROLS',
            collapsible: true,
            collapsed: window.top.innerWidth < MIN_DESKTOP_WIDTH
        },
            React.createElement(SelectInput, { id: 'deviceTypeSelectInput', options: [
                    { t: deviceTypeNames[DEVICETYPE_WEBGL1], v: DEVICETYPE_WEBGL1 },
                    { t: deviceTypeNames[DEVICETYPE_WEBGL2], v: DEVICETYPE_WEBGL2 },
                    { t: deviceTypeNames[DEVICETYPE_WEBGPU], v: DEVICETYPE_WEBGPU }
                ], value: DEVICETYPE_WEBGL2, onSelect: this.onSetPreferredGraphicsDevice, prefix: 'Active Device: ', 
                // @ts-ignore this is setting a legacy ref
                ref: this.deviceTypeSelectInputRef }),
            React.createElement(ControlLoader, { path: this.path, files: this.props.files })));       
    }
}
const ExamptWithRouter = withRouter(Example);
export {
    ExamptWithRouter as Example,
    controlsObserver,
};
