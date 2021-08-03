import React, { useEffect, useState } from 'react';
import ControlPanel from './control-panel';
// @ts-ignore: library file import
import { Container, Spinner } from '@playcanvas/pcui/pcui-react';
import * as playcanvas from 'playcanvas/build/playcanvas.js';
// @ts-ignore: library file import
import * as playcanvasDebug from 'playcanvas/build/playcanvas.dbg.js';
// @ts-ignore: library file import
import * as playcanvasPerformance from 'playcanvas/build/playcanvas.prf.js';
// @ts-ignore: library file import
import * as pcx from 'playcanvas/build/playcanvas-extras.js';
// @ts-ignore: library file import
import * as Babel from '@babel/standalone';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/pcui/pcui-binding';
import * as javascriptErrorOverlay from '../../lib/javascriptErrorOverlay';
import { File } from './helpers/types';
import { Loader } from './helpers/loader';

import { wasmSupported, loadWasmModuleAsync } from '../wasm-loader';

const APP_STATE = {
    LOADING: 'STATE_LOADING',
    PLAYING: 'STATE_PLAYING',
    ERROR: 'STATE_ERROR'
};

interface ExampleIframeProps {
    controls: any,
    assets: any,
    files: Array<File>,
    engine: string,
    debugExample?: any
}

const ExampleIframe = (props: ExampleIframeProps) => {
    let pc: any;
    if (props.engine === 'DEBUG') {
        pc = playcanvasDebug;
    } else if (props.engine === 'PERFORMANCE') {
        pc = playcanvasPerformance;
    } else {
        pc = playcanvas;
    }
    // expose PlayCanvas as a global in the iframe
    (window as any).pc = pc;

    const [appState, setAppState] = useState(APP_STATE.LOADING);
    const [appError, setAppError] = useState(null);

    let files: Array<File>;
    // Try to retrieve a set of B64 encoded files from the URL's query params.
    // If not present then use the default files passed in the props
    try {
        files = JSON.parse(decodeURIComponent(atob(location.hash.split('files=')[1])));
    } catch (e) {
        files = props.files;
    }

    const fullscreen = location.hash.includes('fullscreen=true');

    const loadChildAssets = (children: any, app: pc.Application, onLoadedAssets: any) => {
        if (!children) {
            onLoadedAssets({}, '');
            return;
        }
        if (!Array.isArray(children)) {
            children = [children];
        }
        children = children.map((child: any) => {
            (window.top as any).child = child;
            const childProperties = { ...child.props };
            // looks for updates to any of the assets in files supplied to the example iframe
            files.forEach((file: File, i: number) => {
                if (i === 0) return;
                if (file.name === child.props.name) {
                    childProperties.data = file.type === 'json' ? JSON.parse(file.text) : file.text;
                }
            });
            childProperties.load = child.type.load;
            return childProperties;
        });
        Loader.load(app, children, onLoadedAssets);
    };

    const executeScript = (script: string, pc: any, canvas: HTMLCanvasElement, app: pc.Application, assets: any, data: any) => {
        if (props.debugExample) {
            // @ts-ignore
            const args = {
                pc,
                canvas,
                assets,
                data,
                wasmSupported,
                loadWasmModuleAsync,
                pcx
            };

            props.debugExample.init(assets);

            // typescript compiles to strict mode js so we can't access the functions arguments property. We'll get them from it's string instead.
            const exampleFuncString = props.debugExample.example.toString();
            const exampleFuncArguments = exampleFuncString.substring(0, exampleFuncString.indexOf(')')).replace('function (', '').split(', ');
            // @ts-ignore call the example function with it's required arguments
            props.debugExample.example(...exampleFuncArguments.map((a: string) => args[a]));
            return;
        }
        // strip the function closure
        script = script.substring(script.indexOf("\n") + 1);
        script = script.substring(script.lastIndexOf("\n") + 1, -1);
        // transform the code using babel
        let transformedScript = Babel.transform(script, { filename: `transformedScript.tsx`, presets: ["typescript"] }).code;
        // strip the PlayCanvas app initialization
        const indexOfAppCallStart = transformedScript.indexOf('const app');
        const indexOfAppCallEnd = indexOfAppCallStart + transformedScript.substring(indexOfAppCallStart, transformedScript.length - 1).indexOf(';');
        const appCall = transformedScript.substring(indexOfAppCallStart, indexOfAppCallEnd + 1);
        transformedScript = transformedScript.replace(appCall, '');

        // @ts-ignore: abstract class function
        Function('pc', 'canvas', 'app', 'assets', 'data', 'wasmSupported', 'loadWasmModuleAsync', 'pcx', transformedScript).bind(window)(pc, canvas, app, assets, data, wasmSupported, loadWasmModuleAsync, pcx);
    };


    const build = (canvas: HTMLCanvasElement, script: string, assets: any = null, exampleData: any = null) => {
        (window as any).hasBuilt = true;
        // Create the application and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas),
            gamepads: new pc.GamePads(),
            keyboard: new pc.Keyboard(window),
            graphicsDeviceOptions: { alpha: true }
        });

        const miniStats: any = new pcx.MiniStats(app);
        app.on('update', () => {
            miniStats.enabled = (window?.parent as any)?._showMiniStats;
        });

        (window as any).app = app;

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
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
                executeScript(script, pc, canvas, app, assetManifest, exampleData);
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
                    app.destroy();
                };
                // @ts-ignore
                javascriptErrorOverlay.default.getStackFramesFast(e)
                    .then(_crashInner);
                return false;
            }
        });
    };

    const hasBasisAssets = () => {
        if (props.assets) {
            for (let i = 0; i < props.assets.length; i++) {
                if (props.assets[i].props.url && props.assets[i].props.url.includes('.basis')) {
                    return true;
                }
            }
        }
        return false;
    };

    const observer = new Observer({});
    const controls  = props.controls ? props.controls(observer).props.children : null;

    useEffect(() => {
        if (!(window as any).hasBuilt && files[0].text.length > 0) {
            // @ts-ignore
            if (hasBasisAssets()) {
                // @ts-ignore
                pc.basisInitialize({
                    glueUrl: 'static/lib/basis/basis.wasm.js',
                    wasmUrl: 'static/lib/basis/basis.wasm.wasm',
                    fallbackUrl: 'static/lib/basis/basis.js'
                });
                build(document.getElementById('application-canvas') as HTMLCanvasElement, files[0].text, props.assets, observer);
            } else {

                build(document.getElementById('application-canvas') as HTMLCanvasElement, files[0].text, props.assets, observer);
            }
        }
    });

    // @ts-ignore
    const overlay = <javascriptErrorOverlay.default.RuntimeError
        errorRecord={appError}
        editorHandler={null}
    />;
    return <>
        <canvas id="application-canvas"></canvas>
        { !fullscreen && <ControlPanel controls={controls} files={files}/> }
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
