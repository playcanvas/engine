import React, { Component } from 'react';
import { Container, Spinner, SelectInput, Panel } from '@playcanvas/pcui/react';
import { SelectInput as SelectInputClass } from '@playcanvas/pcui';
import { File } from './helpers/types';
import examples from './helpers/example-data.mjs';
// @ts-ignore: library file import
import { withRouter } from 'react-router-dom';
import ControlPanel from './control-panel';
import { Observer } from '@playcanvas/observer';

const DEVICETYPE = {
    WEBGL1: 'webgl1',
    WEBGL2: 'webgl2',
    WEBGPU: 'webgpu'
};

const deviceTypeNames = {
    [DEVICETYPE.WEBGL1]: 'WebGL 1',
    [DEVICETYPE.WEBGL2]: 'WebGL 2',
    [DEVICETYPE.WEBGPU]: 'WebGPU'
};

const controlsObserver = new Observer();

const Controls = (props: any) => {
    const controlsFunction = (examples as any).paths[props.path].example.prototype.controls;
    const controls = controlsFunction ? (examples as any).paths[props.path].example.prototype.controls((window as any).observerData).props.children : null;
    // on desktop dont show the control panel when no controls are present
    if (!controls && window.top.innerWidth > 600) return null;
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


            const pollHandler = setInterval(appCreationPoll, 50);
            function appCreationPoll() {
                if ((window as any).pc.app) {
                    clearInterval(pollHandler);
                    const app: { graphicsDevice: { activeDeviceType: string } } = (window as any).pc.app;
                    const activeDevice = app.graphicsDevice.activeDeviceType;
                    controlsObserver.emit('updateActiveDevice', activeDevice);
                }
            }
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
        if ((preferredDevice === DEVICETYPE.WEBGL2 || preferredDevice === DEVICETYPE.WEBGPU) && activeDevice === DEVICETYPE.WEBGL1) {
            selectInput.fallbackOrder = [DEVICETYPE.WEBGPU, DEVICETYPE.WEBGL2, DEVICETYPE.WEBGL1];
            selectInput.disabledOptions = {
                [DEVICETYPE.WEBGPU]: 'WebGPU (not supported)',
                [DEVICETYPE.WEBGL2]: 'WebGL 2 (not supported)'
            };
        } else if (preferredDevice === DEVICETYPE.WEBGL1 && activeDevice === DEVICETYPE.WEBGL2) {
            selectInput.fallbackOrder = [DEVICETYPE.WEBGL1, DEVICETYPE.WEBGL2, DEVICETYPE.WEBGPU];
            selectInput.disabledOptions = {
                [DEVICETYPE.WEBGL1]: 'WebGL 1 (not supported)'
            };
        } else if (preferredDevice === DEVICETYPE.WEBGPU && activeDevice !== DEVICETYPE.WEBGPU) {
            selectInput.fallbackOrder = [DEVICETYPE.WEBGPU, DEVICETYPE.WEBGL2, DEVICETYPE.WEBGL1];
            selectInput.disabledOptions = {
                [DEVICETYPE.WEBGPU]: 'WebGPU (not supported)'
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
            return window.top.innerWidth < 601 && this.props.files !== nextProps.files;
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
            <Panel id='controlPanel' class={[window.top.innerWidth < 601 ? 'mobile' : null]} resizable='top' headerText={window.top.innerWidth < 601 ? 'CODE & CONTROLS' : 'CONTROLS'} collapsible={true} collapsed={window.top.innerWidth < 601}>
                <SelectInput
                    id='deviceTypeSelectInput'
                    options={[
                        { t: deviceTypeNames[DEVICETYPE.WEBGL1], v: DEVICETYPE.WEBGL1 },
                        { t: deviceTypeNames[DEVICETYPE.WEBGL2], v: DEVICETYPE.WEBGL2 },
                        { t: deviceTypeNames[DEVICETYPE.WEBGPU], v: DEVICETYPE.WEBGPU }
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
