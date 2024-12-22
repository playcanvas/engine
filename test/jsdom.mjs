import { JSDOM } from 'jsdom';

import * as pc from '../src/index.js';  // Import all engine exports

let jsdom;

const html = `<!DOCTYPE html>
<html>
    <head>
    </head>
    <body>
    </body>
</html>`;

function setupJsdom() {
    jsdom = new JSDOM(html, {
        resources: 'usable',
        runScripts: 'dangerously',
        url: 'http://localhost:3000'
    });

    global.window = jsdom.window;
    global.document = jsdom.window.document;

    global.ArrayBuffer = jsdom.window.ArrayBuffer;
    global.DataView = jsdom.window.DataView;
    global.Image = jsdom.window.Image;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;
    global.MouseEvent = jsdom.window.MouseEvent;
    global.XMLHttpRequest = jsdom.window.XMLHttpRequest;

    global.pc = pc;
    jsdom.window.pc = pc;
}

function teardownJsdom() {
    jsdom = null;
}

export { setupJsdom, teardownJsdom };
