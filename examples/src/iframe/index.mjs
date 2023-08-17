import * as observer from '@playcanvas/observer';
import * as pcx from 'playcanvas-extras';
import * as realExamples from "../examples/index.mjs";
import * as pc from "playcanvas";
import * as dirs from '../assetPath.mjs';
import '../app/polyfills.mjs';
window.pc = window.top.pc = pc;
/**
 * @param {pc.AppBase} app - The application.
 */
function setupApplication(app) {
    const canvas = app.graphicsDevice.canvas;
    // handle resizing
    var canvasContainerElement = canvas.parentElement;
    canvas.setAttribute('width', window.innerWidth + 'px');
    canvas.setAttribute('height', window.innerHeight + 'px');
    var resizeTimeout = null;
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    // triggers resize every frame for camera/fly+orbit
    // if (window.ResizeObserver) {
    //     new ResizeObserver(function() {
    //         canvas.width = canvasContainerElement.clientWidth;
    //         canvas.height = canvasContainerElement.clientHeight;
    //     }).observe(canvasContainerElement);
    // }
    if (app.graphicsDevice.deviceType !== 'webgpu' && !Example.MINISTATS) {
        // set up miniStats
        var miniStats = new pcx.MiniStats(app);
        if (urlParams.get('miniStats') === 'false') {
            miniStats.enabled = false;
        }
        false && app.on('update', function () {
            if (window.top._showMiniStats !== undefined) {
                miniStats.enabled = window.top._showMiniStats;
            }
        });
    }
}
/**
 * @returns {string}
 */
function getDeviceType() {
    if (Example.WEBGPU_ENABLED) {
        let preferredDevice = 'webgpu';
        // Lack of Chrome's WebGPU support on Linux
        if (navigator.platform.includes('Linux') && navigator.appVersion.includes("Chrome")) {
            preferredDevice = 'webgl2';
        }
        return window.top.preferredGraphicsDevice || preferredDevice;
    } else if (['webgl1', 'webgl2'].includes(window.top.preferredGraphicsDevice)) {
        return window.top.preferredGraphicsDevice;
    } else {
        return 'webgl2';
    }
}
/**
 * @param {HTMLCanvasElement} canvas - The canvas.
 * @param {Record<string, string>} [files] - The files.
 * @param {observer.Observer} data - The observer.
 * @param {Function} exampleFunction - The example function.
 */
async function callExample(canvas, files = {}, data, exampleFunction) {
    const deviceType = getDeviceType();
    /** @type {import('../options.mjs').ExampleOptions} */
    const options = {
        canvas,
        files,
        data,
        pcx,
        deviceType,
        ...dirs,
    }
    const app = await exampleFunction(options);
    class ExampleLoadEvent extends CustomEvent {
        /** @type {string} */
        deviceType;
        /**
         * @param {string} deviceType
         */
        constructor(deviceType) {
            super("exampleLoad");
            this.deviceType = deviceType;
        }
    }
    if (app.graphicsDevice?.canvas) {
        setupApplication(app);
        const event = new ExampleLoadEvent(app.graphicsDevice.deviceType);
        window.top.dispatchEvent(event);
    } else {
        console.warn("no canvas")
    }
}
// polyfill slice on UInt8Array
if (!Uint8Array.prototype.slice) {
    Object.defineProperty(Uint8Array.prototype, 'slice', {
        value: function (begin, end) {
            return new Uint8Array(Array.prototype.slice.call(this, begin, end));
        }
    });
}
// get url parameters
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
// notify the parent window that the example is loading
const event = new CustomEvent("exampleLoading");
window.top.dispatchEvent(event);
let found = false;
const categorySlug = urlParams.get('category');
const exampleSlug = urlParams.get('example');
// console.log("trying to load", categorySlug, exampleSlug);
if (categorySlug && exampleSlug) {
    window.Example = realExamples[categorySlug][`${exampleSlug}Example`];
    if (window.Example) {
        found = true;
    }
}
if (!found) {
    console.warn('No example specified, displaying a list of all examples instead.')
    const examplesContainer = document.createElement('div');
    Object.keys(examples).forEach(function(category) {
        const categoryHeader = document.createElement('h2');
        categoryHeader.innerText = category;
        examplesContainer.append(categoryHeader);
        Object.keys(examples[category]).forEach(function(example) {
            const exampleLink = document.createElement('a');
            exampleLink.href = `?category=${category}&example=${example.replace('Example', '')}`;
            exampleLink.innerText = example.replace('Example', '');
            examplesContainer.append(exampleLink);
            examplesContainer.append(document.createElement('br'));
        });
    });
    document.body.prepend(examplesContainer);
    document.body.removeChild(document.getElementById('app'))
    document.body.style = 'background-color: white; padding: 15px; overflow: auto;';
} else {
    window.exampleFunction = window.top.localStorage.getItem(window.top.location.hash.replace('#', ''));
    if (!window.exampleFunction) {
        window.exampleFunction = Example.example;
    } else {
        window.exampleFunction = new Function('return ' + exampleFunction)();
    }
    window.files = window.top.editedFiles || Example.FILES;
    // create the example observer 
    const data = new observer.Observer({});
    window.top.observerData = data;
    // load the engine, create the application, load the resources if necessary, then call the example
    const canvas = document.getElementById('application-canvas');
    callExample(canvas, window.files, data, window.exampleFunction)
      .catch((e) => {
        console.error("callExample>", e);
      });
}
