import React, { createRef, useEffect, useState } from 'react';
import ControlPanel from './control-panel';
// @ts-ignore: library file import
import { Container, Spinner } from '@playcanvas/pcui/pcui-react';
import * as pc from 'playcanvas';
// @ts-ignore: library file import
import * as Babel from '@babel/standalone';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/pcui/pcui-binding';
import * as javascriptErrorOverlay from '../../lib/javascriptErrorOverlay';
import { File } from './helpers/types';

const APP_STATE = {
    LOADING: 'STATE_LOADING',
    PLAYING: 'STATE_PLAYING',
    ERROR: 'STATE_ERROR'
};

interface ExampleIframeProps {
    controls: any,
    assets: any,
    files: Array<File>
}

const ExampleIframe = (props: ExampleIframeProps) => {
    const [appState, setAppState] = useState(APP_STATE.LOADING);
    const [appError, setAppError] = useState(null);
    let files: Array<File>;
    // Try to retrieve a set of B64 encoded files from the URL's query params.
    // If not present then use the default files passed in the props
    try {
        files = JSON.parse(atob(location.hash.split('files=')[1]));
    } catch (e) {
        files = props.files;
    }

    // asset loader function allowing to load multiple assets
    const loadManifestAssets = (app: pc.Application, manifest: any, onLoadedAssets: (assetManifest: any) => any) => {
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
    };

    const loadChildAssets = (children: any, app: pc.Application, onLoadedAssets: any) => {
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
        files.forEach((file: File, i: number) => {
            if (i === 0) return;
            assetManifest[file.name].data = file.type === 'json' ? JSON.parse(file.text) : file.text;
        });
        loadManifestAssets(app, assetManifest, onLoadedAssets);
    };

    const executeScript = (script: string, pc: any, app: pc.Application, assetManifest: any, exampleData: any) => {
        // strip the function closure
        script = script.substring(script.indexOf("\n") + 1);
        script = script.substring(script.lastIndexOf("\n") + 1, -1);
        // transform the code using babel
        let transformedScript = Babel.transform(script, { filename: `transformedScript.tsx`, presets: ["typescript"] }).code;
        // // strip the PlayCanvas app initialisation
        const indexOfAppCallStart = transformedScript.indexOf('const app');
        const indexOfAppCallEnd = indexOfAppCallStart + transformedScript.substring(indexOfAppCallStart, transformedScript.length - 1).indexOf(';');
        const appCall = transformedScript.substring(indexOfAppCallStart, indexOfAppCallEnd + 1);
        transformedScript = transformedScript.replace(appCall, '');

        // @ts-ignore: abstract class function
        return Function('pc', 'app', 'assets', 'data', transformedScript)(pc, app, assetManifest, exampleData);
    };


    const build = (canvas: HTMLElement, script: string, assets: any = null, exampleData: any = null) => {
        (window as any).hasBuilt = true;
        // Create the application and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas),
            gamepads: new pc.GamePads()
        });

        // // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        const canvasContainerElement = canvas.parentElement;
        setTimeout(() => {
            app.resizeCanvas(canvasContainerElement.clientWidth, canvasContainerElement.clientHeight);
            // @ts-ignore
            canvas.width = canvasContainerElement.clientWidth;
            canvas.setAttribute('style', `
                width: ${canvasContainerElement.clientWidth}px;
                height: ${canvasContainerElement.clientHeight}px;
            `);
        });

        let resizeTimeout: any = null;
        new ResizeObserver(() => {
            if (app?.graphicsDevice?.canvas) {
                if (resizeTimeout) {
                    window.clearTimeout(resizeTimeout);
                }
                resizeTimeout = setTimeout(() => {
                    app.resizeCanvas(canvasContainerElement.offsetWidth, canvasContainerElement.offsetHeight);
                    // @ts-ignore
                    canvas.width = canvasContainerElement.clientWidth;
                });
            }
        }).observe(canvasContainerElement);

        // @ts-ignore
        loadChildAssets(assets, pc.app, (assetManifest: any) => {
            try {
                executeScript(script, pc, app, assetManifest, exampleData);
                setAppState(APP_STATE.PLAYING);
            } catch (e) {
                const _crashInner = (stackFrames: any) => {
                    if (stackFrames == null) {
                        return;
                    }
                    setAppState(APP_STATE.ERROR);
                    setAppError({
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
        });
    };
    const observer = new Observer({});
    const controls  = props.controls ? props.controls(observer).props.children : null;
    useEffect(() => {
        if (!(window as any).hasBuilt && files[0].text.length > 0) {
            build(document.getElementById('application-canvas'), files[0].text, props.assets, observer);
        }
    });
    // @ts-ignore
    const overlay = <javascriptErrorOverlay.default.RuntimeError
        errorRecord={appError}
        editorHandler={null}
    />;
    return <>
        <canvas id="application-canvas"></canvas>
        <ControlPanel controls={controls} files={files}/>
        {
            appState === APP_STATE.LOADING && <Spinner size={50} />
        }
        {
            appState === APP_STATE.ERROR && !!appError && <Container id='errorContainer'>
                { overlay }
            </Container>
        }
    </>;
};

export default ExampleIframe;
