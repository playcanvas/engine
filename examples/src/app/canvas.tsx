import React, { createRef } from 'react';
import * as pc from 'playcanvas';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/pcui/pcui-binding';
// @ts-ignore: library file import
import { Container, Spinner } from '@playcanvas/pcui/pcui-react';
import * as javascriptErrorOverlay from '../../lib/javascriptErrorOverlay';
import ControlPanel from './control-panel';
import { File } from './helpers/types';
// @ts-ignore: library file import
import * as Babel from '@babel/standalone';

const APP_STATE = {
    LOADING: 'STATE_LOADING',
    PLAYING: 'STATE_PLAYING',
    ERROR: 'STATE_ERROR'
};


const filesHaveChanged = (a: Array<File>, b: Array<File>) => {
    if (a && !b) return true;
    if (a.length !== b.length) {
        return true;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i].text !== b[i].text) {
            return true;
        }
    }
    return false;
};


interface CanvasProps {
    defaultFiles: Array<File>,
    files: Array<File>,
    controls: any,
    exampleData: any,
    path: string,
    events: pc.EventHandler,
    setPlayFunction: any
}

interface CanvasState {
    showParameters: boolean,
    showCode: boolean,
    appState: string,
    codeError: any
}

class Canvas extends React.Component<CanvasProps, CanvasState> {
    canvasRef: any;
    assetManifest: any;
    canvasHasLoaded: boolean;
    playEvent: any;

    constructor(props: any) {
        super(props);
        this.canvasRef = createRef();
        this.state = {
            showParameters: true,
            showCode: false,
            appState: APP_STATE.LOADING,
            codeError: null
        };
    }

    playExample() {
        if (location.hash.includes(this.props.path)) {
            this.build();
        }
    }

    // asset loader function allowing to load multiple assets
    loadManifestAssets(app: pc.Application, manifest: any, onLoadedAssets: (assetManifest: any) => any) {
        // count of assets to load
        let count = 0;
        let key;
        for (key in manifest) {
            if (manifest.hasOwnProperty(key)) {
                count++;
            }
        }

        function onLoadedAsset(key: string, asset: pc.Asset) {
            count--;
            manifest[key] = asset;
            if (count === 0) {
                if (onLoadedAssets) {
                    onLoadedAssets(manifest);
                }
            }
        }

        // load all assets in the manifest
        Object.keys(manifest).forEach(function (key) {
            if (manifest.hasOwnProperty(key)) {
                const entry = manifest[key];
                if (entry.data) {
                    const asset = new pc.Asset(key, entry.type, entry.url, entry.data);
                    asset.on('load', function (asset) {
                        onLoadedAsset(key, asset);
                    });
                    app.assets.add(asset);
                    app.assets.load(asset);
                } else {
                    app.assets.loadFromUrl(entry.url, entry.type, function (err, asset) {
                        if (!err && asset) {
                            onLoadedAsset(key, asset);
                        }
                    });
                }
            }
        });
    }

    loadChildAssets(children: any, app: pc.Application, onLoadedAssets: any) {
        if (!children) {
            onLoadedAssets({});
            return;
        }
        if (!Array.isArray(children)) {
            children = [children];
        }
        const assetManifest: any = {};
        children.forEach((child: any) => {
            if (child.props.data || child.props.url) {
                assetManifest[child.props.name] = {
                    type: child.props.type,
                    data: child.props.data,
                    url: child.props.url
                };
            }
        });
        this.loadManifestAssets(app, assetManifest, onLoadedAssets);
    }

    componentDidMount() {
        this.props.setPlayFunction({ f: this.playExample.bind(this) });
        this.playExample();
    }

    get app() {
        return (window as any).pcapp;
    }

    set app(value: any) {
        (window as any).pcapp = value;
    }

    // componentWillUnmount() {
    //     if (this.app) {
    //         this.app.destroy();
    //     }
    // }

    get files() {
        if (this.props.files.length > 0 && this.props.files[0]?.text?.length > 0) {
            return this.props.files;
        }
        return this.props.defaultFiles;
    }

    get executableExample() {
        let editableString = this.files[0].text;

        // strip the function closure
        editableString = editableString.substring(editableString.indexOf("\n") + 1);
        editableString = editableString.substring(editableString.lastIndexOf("\n") + 1, -1);
        // transform the code using babel
        let transformedCode = Babel.transform(editableString, { filename: `transformedCode.tsx`, presets: ["typescript"] }).code;
        // // strip the PlayCanvas app initialisation
        const indexOfAppCallStart = transformedCode.indexOf('const app');
        const indexOfAppCallEnd = indexOfAppCallStart + transformedCode.substring(indexOfAppCallStart, transformedCode.length - 1).indexOf(';');
        const appCall = transformedCode.substring(indexOfAppCallStart, indexOfAppCallEnd + 1);
        transformedCode = transformedCode.replace(appCall, '');

        // @ts-ignore: abstract class function
        return Function('pc', 'app', 'assets', 'data', transformedCode);
    }

    executeExample(exampleData: any) {
        try {
            while (this.app.root?.children?.length > 0) {
                this.app.root.children.forEach((c: any) => c.destroy());
            }
            this.executableExample(pc, this.app, this.assetManifest, exampleData);
            this.setState({
                appState: APP_STATE.PLAYING
            });
            // props.setCodeError(null);
        } catch (e) {
            const _crashInner = (stackFrames: any) => {
                if (stackFrames == null) {
                    return;
                }
                this.setState({
                    codeError: {
                        error: e,
                        unhandledRejection: false,
                        contextSize: 3,
                        stackFrames
                    },
                    appState: APP_STATE.ERROR
                });
                console.error(e);
            };
            // @ts-ignore
            javascriptErrorOverlay.default.getStackFramesFast(e)
                .then(_crashInner);
            return false;
        }
    }

    build() {
        if (!this.canvasRef.current) return;
        const canvas = this.canvasRef.current;
        // @ts-ignore
        const app = pc.app;
        if (app) {
            // app.graphicsDevice.loseContext();
            app.destroy();
            // @ts-ignore
            pc.app = null;
        }
        // Create the application and start the update loop
        this.app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas),
            gamepads: new pc.GamePads()
        });
        // // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

        const canvasContainerElement = canvas.parentElement;
        setTimeout(() => {
            this.app.resizeCanvas(canvasContainerElement.clientWidth, canvasContainerElement.clientHeight);
            canvas.width = canvasContainerElement.clientWidth;
            canvas.setAttribute('style', `
                width: ${canvasContainerElement.clientWidth}px;
                height: ${canvasContainerElement.clientHeight}px;
            `);
        });

        let resizeTimeout: any = null;
        new ResizeObserver(() => {
            if (this?.app?.graphicsDevice?.canvas) {
                if (resizeTimeout) {
                    window.clearTimeout(resizeTimeout);
                }
                resizeTimeout = setTimeout(() => {
                    this.app.resizeCanvas(canvasContainerElement.offsetWidth, canvasContainerElement.offsetHeight);
                    canvas.width = canvasContainerElement.clientWidth;
                });
            }
        }).observe(canvasContainerElement);

        // @ts-ignore
        this.loadChildAssets(this.props.children, pc.app, (assetManifest: any) => {
            this.assetManifest = assetManifest;
            this.executeExample(this.props.exampleData);
        });
    }

    render() {
        // @ts-ignore
        const overlay = <javascriptErrorOverlay.default.RuntimeError
            errorRecord={this.state.codeError}
            editorHandler={null}
        />;
        return <>
            <iframe src={`/#/iframe/${this.props.path}?files=${btoa(JSON.stringify(this.props.files))}`}></iframe>
            {
                this.state.appState === APP_STATE.LOADING && <Spinner size={50} />
            }
            {
                this.state.appState === APP_STATE.ERROR && <Container id='errorContainer'>
                    { overlay }
                </Container>
            }
        </>;
    }
}

export default Canvas;
