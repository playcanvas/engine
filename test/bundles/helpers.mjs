import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

import { JSDOM } from 'jsdom';

// resolve a path under build/ relative to the repo root
const build = p => fileURLToPath(new URL(`../../build/${p}`, import.meta.url));

// url the engine assumes when reading document.baseURI / location
const URL_ORIGIN = 'http://localhost:3210';

// representative slice of the public api; parity (below) enforces the full surface
export const EXPECTED_EXPORTS = [
    'AppBase', 'app', 'Application', 'Entity', 'Scene',
    'Vec2', 'Vec3', 'Vec4', 'Mat3', 'Mat4', 'Quat', 'Color',
    'GraphicsDevice', 'NullGraphicsDevice', 'Texture', 'Mesh',
    'Material', 'StandardMaterial', 'Asset', 'AssetRegistry', 'Camera'
];

// the four single-file umd bundles, loadable as a browser global or as commonjs
export const UMD_TARGETS = [
    { name: 'rel umd', path: build('playcanvas.js') },
    { name: 'dbg umd', path: build('playcanvas.dbg.js') },
    { name: 'prf umd', path: build('playcanvas.prf.js') },
    { name: 'min umd', path: build('playcanvas.min.js') }
];

// esm single-file bundles plus the unbundled trees that `import 'playcanvas'` resolves to
// (min has no tree)
export const ESM_TARGETS = [
    { name: 'rel esm bundle', path: build('playcanvas.mjs') },
    { name: 'dbg esm bundle', path: build('playcanvas.dbg.mjs') },
    { name: 'prf esm bundle', path: build('playcanvas.prf.mjs') },
    { name: 'min esm bundle', path: build('playcanvas.min.mjs') },
    { name: 'rel esm tree', path: build('playcanvas/src/index.js') },
    { name: 'dbg esm tree', path: build('playcanvas.dbg/src/index.js') },
    { name: 'prf esm tree', path: build('playcanvas.prf/src/index.js') }
];

// the engine's source export surface — the authoritative api every build must preserve.
// anchoring on src (not a build artifact) means a uniform drop/rename by the build pipeline
// is caught, instead of all targets silently agreeing with an equally-broken canonical.
export const SOURCE_INDEX = fileURLToPath(new URL('../../src/index.js', import.meta.url));

// the set of public export names, sorted, with the esm-only `default` filtered out
export const exportNames = ns => Object.keys(ns).filter(k => k !== 'default').sort();

// run a umd bundle inside a jsdom vm context so every dom reference it makes resolves to
// that window, regardless of the realm calling into the returned classes
export const loadUmdGlobal = (path) => {
    const dom = new JSDOM('<!doctype html><body></body>', {
        url: URL_ORIGIN,
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    vm.runInContext(readFileSync(path, 'utf8'), dom.getInternalVMContext(), { filename: path });
    return { pc: dom.window.pc, dom };
};

// run a umd bundle through its commonjs branch and return the populated exports
export const loadUmdCjs = (path) => {
    const mod = { exports: {} };
    const ctx = vm.createContext({ module: mod, exports: mod.exports });
    vm.runInContext(readFileSync(path, 'utf8'), ctx, { filename: path });
    return mod.exports;
};

// native esm load
export const loadEsm = path => import(pathToFileURL(path).href);

let dom;

// mirror test/jsdom.mjs: put the dom apis the engine reads onto node's global so an imported
// esm bundle can construct an app. omits the src import that jsdom.mjs does.
export const setupDom = () => {
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        resources: 'usable',
        runScripts: 'dangerously',
        url: URL_ORIGIN
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.ArrayBuffer = dom.window.ArrayBuffer;
    global.Audio = dom.window.Audio;
    global.DataView = dom.window.DataView;
    global.Image = dom.window.Image;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    global.MouseEvent = dom.window.MouseEvent;
    global.XMLHttpRequest = dom.window.XMLHttpRequest;

    global.Worker = class {
        constructor(url) {
            this.url = url;
        }

        postMessage(msg) {}

        terminate() {}

        onmessage = null;

        addEventListener() {}

        removeEventListener() {}
    };

    return dom;
};

export const teardownDom = () => {
    dom?.window.close();
    dom = null;
};

// build an app from a loaded bundle, mirroring test/app.mjs but sourced from `pc`
export const createAppFrom = (pc, doc) => {
    const canvas = doc.createElement('canvas');
    return new pc.Application(canvas, { graphicsDevice: new pc.NullGraphicsDevice(canvas) });
};
