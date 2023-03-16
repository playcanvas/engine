import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { Container, Spinner, SelectInput, Panel } from '@playcanvas/pcui/react';
import { SelectInput as SelectInputClass } from '@playcanvas/pcui';
import { Observer } from '@playcanvas/observer';
import { DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU } from '../../../build/playcanvas.mjs';
import { File } from './helpers/types';
import examples from './helpers/example-data.mjs';
import ControlPanel from './control-panel';
import { MIN_DESKTOP_WIDTH } from './constants';

const deviceTypeNames = {
    [DEVICETYPE_WEBGL1]: 'WebGL 1',
    [DEVICETYPE_WEBGL2]: 'WebGL 2',
    [DEVICETYPE_WEBGPU]: 'WebGPU'
};

const controlsObserver = new Observer();

const Controls = (props: any) => {
    const controlsFunction = (examples as any).paths[props.path].example.prototype.controls;
    const controls = controlsFunction ? (examples as any).paths[props.path].example.prototype.controls((window as any).observerData).props.children : null;
    // on desktop dont show the control panel when no controls are present
    if (!controls && window.top.innerWidth >= MIN_DESKTOP_WIDTH) return null;
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

            const app: { graphicsDevice: { deviceType: string } } = (window as any).pc.app;
            const activeDevice = app.graphicsDevice.deviceType;
            controlsObserver.emit('updateActiveDevice', activeDevice);
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
    deviceTypeSelectInputRef;

    constructor(props: any) {
        super(props);
        this.deviceTypeSelectInputRef = React.createRef();

        controlsObserver.on('updateActiveDevice', this.onSetActiveGraphicsDevice);
    }

    get defaultFiles() {
        return (examples as any).paths[this.path].files;
    }

    get path() {
        return `/${this.props.match.params.category}/${this.props.match.params.example}`;
    }

    get deviceTypeSelectInput() {
        return (this.deviceTypeSelectInputRef.current as { element: SelectInputClass }).element;
    }

    set preferredGraphicsDevice(value: string) {
        (window as any).preferredGraphicsDevice = value;
    }

    get preferredGraphicsDevice() {
        return (window as any).preferredGraphicsDevice;
    }

    setDisabledOptions = (preferredDevice = 'webgpu', activeDevice: string) => {
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

    onSetActiveGraphicsDevice = (value: string) => {
        if (!this.preferredGraphicsDevice) {
            this.preferredGraphicsDevice = value;
            this.deviceTypeSelectInput.value = value;
        }
        this.setDisabledOptions(this.preferredGraphicsDevice, value);
        document.getElementById('showMiniStatsButton').ui.enabled = value !== DEVICETYPE_WEBGPU;
    };

    onSetPreferredGraphicsDevice = (value: string) => {
        this.deviceTypeSelectInput.disabledOptions = null;
        this.deviceTypeSelectInput.value = value;
        this.preferredGraphicsDevice = value;
        // reload the iframe after updating the device
        const exampleIframe: HTMLIFrameElement = document.getElementById('exampleIframe') as HTMLIFrameElement;
        exampleIframe.contentWindow.location.reload();
    };

    componentDidMount() {
        window.localStorage.removeItem(this.path);
        this.props.setFiles(this.defaultFiles);
    }

    shouldComponentUpdate(nextProps: Readonly<ExampleProps>): boolean {
        const updateMobileOnFileChange = () => {
            return window.top.innerWidth < MIN_DESKTOP_WIDTH && this.props.files !== nextProps.files;
        };
        return this.props.match.params.category !== nextProps.match.params.category || this.props.match.params.example !== nextProps.match.params.example || updateMobileOnFileChange();
    }

    componentDidUpdate() {
        window.localStorage.removeItem(this.path);
        delete (window as any).editedFiles;
        this.props.setFiles(this.defaultFiles);
    }

    render() {
        const iframePath = `/iframe${this.path}`;
        return <Container id="canvas-container">
            <Spinner size={50}/>
            <iframe id="exampleIframe" key={iframePath} src={iframePath}></iframe>
            <Panel id='controlPanel' class={[window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'mobile' : null]} resizable='top' headerText={window.top.innerWidth < MIN_DESKTOP_WIDTH ? 'CODE & CONTROLS' : 'CONTROLS'} collapsible={true} collapsed={window.top.innerWidth < MIN_DESKTOP_WIDTH}>
                <SelectInput
                    id='deviceTypeSelectInput'
                    options={[
                        { t: deviceTypeNames[DEVICETYPE_WEBGL1], v: DEVICETYPE_WEBGL1 },
                        { t: deviceTypeNames[DEVICETYPE_WEBGL2], v: DEVICETYPE_WEBGL2 },
                        { t: deviceTypeNames[DEVICETYPE_WEBGPU], v: DEVICETYPE_WEBGPU }
                    ]}
                    onSelect={this.onSetPreferredGraphicsDevice}
                    prefix='Active Device: '
                    // @ts-ignore this is setting a legacy ref
                    ref={this.deviceTypeSelectInputRef}
                />
                <ControlLoader path={this.path} files={this.props.files} />
            </Panel>
        </Container>;
    }
}

export default withRouter(Example);
