import * as observer from '@playcanvas/observer';
import * as pcuiReal from '@playcanvas/pcui';
import * as pcui from '@playcanvas/pcui/react';
import React from 'react';
import * as pcx from 'playcanvas-extras';
import * as moduleExamples from "../examples/index.mjs";
import * as pc from "playcanvas";
window.pcuiReal = pcuiReal;
window.observer = observer;
window.pcui = window.top.pcui || pcui;
window.React = window.top.React || React;
window.pcx = pcx;
window.pc = pc;
// make pc available outside of the iframe
window.top.pc = window.pc;
Object.assign(window, {moduleExamples});
window.examples = moduleExamples;
function setupApplication(app) {
    const canvas = app.graphicsDevice.canvas;
    // handle resizing
    var canvasContainerElement = canvas.parentElement;
    canvas.setAttribute('width', window.innerWidth + 'px');
    canvas.setAttribute('height', window.innerHeight + 'px');
    var resizeTimeout = null;
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    if (window.ResizeObserver) {
        new ResizeObserver(function() {
            canvas.width = canvasContainerElement.clientWidth;
            canvas.height = canvasContainerElement.clientHeight;
        }).observe(canvasContainerElement);
    }
    if (app.graphicsDevice.deviceType !== 'webgpu' && !Example.MINISTATS) {
        // set up miniStats
        var miniStats = new pcx.MiniStats(app);
        if (urlParams.get('miniStats') === 'false') {
            miniStats.enabled = false;
        }
        app.on('update', function () {
            if (window.top._showMiniStats !== undefined) miniStats.enabled = window.top._showMiniStats;
        });
    }
}
function loadResource(app, resource, callback) {
    if (!resource.type) {
        fetch(resource.url)
            .then(function(response) { return response.text() })
            .then(function(data) {
                var module = {
                    exports: {}
                };
                window[resource.name] = (Function('module', 'exports', data).call(module, module, module.exports), module).exports;
                callback({});
            });
        return;
    }
}
/**
 * @example
 * const argNames = getFunctionArguments(function(
 *   canvas,
 *   deviceType,data
 * ) {});
 * console.log(argNames); // Outputs: ['canvas', 'deviceType', 'data']
 * @param {Function} fn 
 */
function getFunctionArguments(fn) {
    const argsString = fn.toString().match(/.*?\(([^)]*)\)/)[1];
    return argsString
        .replace(/ /g, '')
        .replace(/\n/g, '')
        .split(',');
}
/**
 * @param {HTMLCanvasElement} canvas - The canvas.
 * @param {any[]|undefined} files 
 * @param {observer.Observer} data 
 */
function callExample(canvas, files, data) {
    console.log("callExample", {canvas, files, data})
    const argNames = getFunctionArguments(window.exampleFunction);
    const args = argNames.map(function(arg) {
        if (arg === 'canvas') {
            return canvas;
        } else if (arg === 'files') {
            return files;
        } else if (arg === 'data') {
            return data;
        } else if (arg === 'pcx') {
            return pcx;
        } else if (arg === 'deviceType') {
            //debugger;
            if (Example.WEBGPU_ENABLED) {
                //return window.top.preferredGraphicsDevice || 'webgpu';
                return window.top.preferredGraphicsDevice || 'webgl2';
            } else if (['webgl1', 'webgl2'].includes(window.top.preferredGraphicsDevice)) {
                return window.top.preferredGraphicsDevice;
            } else {
                return 'webgl2';
            }
        }
    });
    window.exampleFunction.apply(this, args);
    const pollHandler = setInterval(appCreationPoll, 50);
    function appCreationPoll() {
        //debugger;
        if (pc.app && pc.app.graphicsDevice.canvas) {
            clearInterval(pollHandler);
            setupApplication(pc.app);
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
            var event = new ExampleLoadEvent(pc.app.graphicsDevice.deviceType);
            window.top.dispatchEvent(event);
        }
    }
}
//console.log({moduleExamples});
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
if (urlParams.get('category') && urlParams.get('example')) {
    window.Example = examples[urlParams.get('category')][`${urlParams.get('example')}Example`];
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
    const example = new Example();
    window.exampleFunction = window.top.localStorage.getItem(window.top.location.hash.replace('#', ''));
    if (!window.exampleFunction) {
        window.exampleFunction = example.example;
    } else {
        window.exampleFunction = new Function('canvas', 'deviceType', 'data', exampleFunction);
    }
    window.loadFunction = example.load;
    window.files = window.top.editedFiles || example.constructor.FILES;
    // create the example observer 
    const data = new observer.Observer({});
    window.top.observerData = data;
    // load the engine, create the application, load the resources if necessary, then call the example
    const canvas = document.getElementById('application-canvas');
    console.log("window.loadFunction", window.loadFunction);
    callExample(canvas, window.files, data);
}
