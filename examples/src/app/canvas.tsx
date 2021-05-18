import React, { createRef } from 'react';
import * as pc from 'playcanvas';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/pcui/pcui-binding';
import * as javascriptErrorOverlay from '../../lib/javascriptErrorOverlay';
import ControlPanel from './control-panel';
import { File } from './helpers/types';

interface CanvasProps {
    setCodeError: any,
    files: Array<File>,
    executableExample: any,
    controls: any,
    exampleData: any,
    state: Observer
}

interface CanvasState {
    showParameters: boolean,
    showCode: boolean
}

class Canvas extends React.Component<CanvasProps, CanvasState> {
    canvasRef: any;
    app: pc.Application;
    assetManifest: any;
    canvasHasLoaded: boolean;

    constructor(props: any) {
        super(props);
        this.canvasRef = createRef();
        this.state = {
            showParameters: true,
            showCode: false
        };
        props.state.on('play', () => {
            this.executeExample(this.props);
        });
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
        this.canvasLoaded(this.canvasRef.current);
    }

    componentWillUnmount() {
        if (this.app) {
            this.app.destroy();
        }
    }

    executeExample(props: any) {
        try {
            while (this.app.root.children.length > 0) {
                this.app.root.children.forEach((c: any) => c.destroy());
            }
            props.executableExample(pc, this.app, this.assetManifest, props.exampleData);
            props.setCodeError(null);
        } catch (e) {
            const _crashInner = (stackFrames: any) => {
                if (stackFrames == null) {
                    return;
                }
                props.setCodeError({
                    error: e,
                    unhandledRejection: false,
                    contextSize: 3,
                    stackFrames
                });
                console.error(e);
            };
            // @ts-ignore
            javascriptErrorOverlay.default.getStackFramesFast(e)
                .then(_crashInner);
            return false;
        }
    }

    shouldComponentUpdate(nextProps: any) {
        let fileChanged = false;
        let fileError = false;
        if (nextProps.files && nextProps.files.length > 1) {
            for (let i = 1; i < nextProps.files.length; i++) {
                if (this.props.files.length > i && this.props.files[i].text !== nextProps.files[i].text || this.props.files.length < i + 1) {
                    fileChanged = true;
                    const file = nextProps.files[i];
                    let assetData = file.text;
                    if (file.type === 'json') {
                        try {
                            assetData = JSON.parse(assetData);
                        } catch (e) {
                            fileError = true;
                            continue;
                        }
                    }
                    this.app.assets.find(file.name).data = assetData;
                    this.app.assets.find(file.name).resource = assetData;
                }
            }
        }
        if (nextProps.executableExample.toString() === this.props.executableExample.toString() && !fileChanged && !fileError) {
            return false;
        }
        this.executeExample(nextProps);
        return false;
    }

    canvasLoaded(canvas: HTMLCanvasElement) {
        if (this.app) {
            this.app.destroy();
        }
        // Create the application and start the update loop
        this.app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas),
            gamepads: new pc.GamePads()
        });
        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
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

        this.loadChildAssets(this.props.children, this.app, (assetManifest: any) => {
            this.assetManifest = assetManifest;
            try {
                this.props.executableExample(pc, this.app, this.assetManifest, this.props.exampleData);
                this.props.setCodeError(null);
            } catch (e) {
                const _crashInner = (stackFrames: any) => {
                    if (stackFrames == null) {
                        return;
                    }
                    this.props.setCodeError({
                        error: e,
                        unhandledRejection: false,
                        contextSize: 3,
                        stackFrames
                    });
                    console.error(e);
                };
                // @ts-ignore
                javascriptErrorOverlay.default.getStackFramesFast(e)
                    .then(_crashInner);
            }
        });
    }

    render() {
        return <>
            <canvas id="application-canvas" ref={this.canvasRef}></canvas>
            <ControlPanel controls={this.props.controls} files={this.props.files}/>
        </>;
    }
}

export default Canvas;
