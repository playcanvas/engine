import { JSDOM } from 'jsdom';

import * as pc from '../src/index.js';

let jsdom;

export const jsdomSetup = () => {
    const html = '<!DOCTYPE html><html><head></head><body></body></html>';

    jsdom = new JSDOM(html, {
        resources: 'usable',         // Allow the engine to load assets
        runScripts: 'dangerously',   // Allow the engine to run scripts
        url: 'http://localhost:3000' // Set the URL of the document
    });

    // Copy the window and document to global scope
    global.window = jsdom.window;
    global.document = jsdom.window.document;

    // Copy the DOM APIs used by the engine to global scope
    global.ArrayBuffer = jsdom.window.ArrayBuffer;
    global.Audio = jsdom.window.Audio;
    global.DataView = jsdom.window.DataView;
    global.Image = jsdom.window.Image;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;
    global.MouseEvent = jsdom.window.MouseEvent;
    global.XMLHttpRequest = jsdom.window.XMLHttpRequest;

    // Worker shim
    global.Worker = class {
        constructor(stringUrl) {
            this.url = stringUrl;
        }

        postMessage(msg) {}

        terminate() {}

        onmessage = null;

        addEventListener() {}

        removeEventListener() {}
    };

    // Copy the PlayCanvas API to global scope (only required for 'classic' scripts)
    jsdom.window.pc = pc;
};

export const jsdomTeardown = () => {
    jsdom = null;
};
