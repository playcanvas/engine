import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as realExamples from "../src/examples/index.mjs";
import { toKebabCase } from '../src/app/helpers/strings.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;
/**
 * @type {Record<string, Record<string, {
 *  example: string,
 *  nameSlug: string,
 *  categorySlug: string,
 *  files: any,
 *  controls: string
 * }>>}
 */
const exampleData = {};
if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/`);
}
if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
}
for (const category_ in realExamples) {
    const category = toKebabCase(category_);
    exampleData[category] = {};
    // @ts-ignore
    const examples = realExamples[category_];
    for (const exampleName_ in examples) {
        const exampleClass = examples[exampleName_];
        const example = toKebabCase(exampleName_).replace('-example', '');
        const exampleFunc = exampleClass.example.toString();
        exampleData[category][example] = {
            example: exampleFunc,
            nameSlug: example,
            categorySlug: category,
            files: undefined,
            controls: ''
        };
        if (exampleClass.FILES) {
            exampleData[category][example].files = exampleClass.FILES;
        }
        if (exampleClass.controls) {
            exampleData[category][example].controls = exampleClass.controls.toString();
        }
        const dropEnding = exampleName_.replace(/Example$/, ""); // TestExample -> Test
        const out = generateExampleFile(category_, dropEnding, exampleClass);
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${category_}_${dropEnding}.html`, out);
    }
}

/**
 * Choose engine based on `Example#ENGINE`, e.g. ClusteredLightingExample picks:
 * static ENGINE = 'PERFORMANCE';
 *
 * @param {'PERFORMANCE'|'DEBUG'|undefined} type - The build type.
 * @returns {string} - The build file.
 */
function engineFor(type) {
    switch (type) {
        case 'PERFORMANCE':
            return './playcanvas.prf.js';
        case 'DEBUG':
            return './playcanvas.dbg.js';
    }
    return './playcanvas.js';
}

/**
 * @typedef {object} ExampleClass
 * @property {Function} example - The example function.
 * @property {Function} [controls] - The controls function.
 * @property {object[]} [imports] - The imports array.
 * @property {string[]} [es5libs] - The ES5Libs array.
 * @property {string} DESCRIPTION - The example description.
 * @property {"PERFORMANCE" | "DEBUG" | undefined} ENGINE - The engine type.
 * @property {object} FILES - The object of extra files to include (e.g shaders).
 * @property {boolean} INCLUDE_AR_LINK - Include AR link png.
 * @property {boolean} NO_DEVICE_SELECTOR - No device selector.
 * @property {boolean} NO_CANVAS - No canvas element.
 * @property {boolean} NO_MINISTATS - No ministats.
 * @property {boolean} WEBGPU_ENABLED - If webGPU is enabled.
 */
/**
 * @param {string} category - The category.
 * @param {string} example - The example.
 * @param {ExampleClass} exampleClass - The example class.
 * @returns {string} File to write as standalone example.
 */
function generateExampleFile(category, example, exampleClass) {
    return `<html>
    <head>
        <link rel="stylesheet" href="./example.css">
        <title>${category}: ${example}</title>
        ${exampleClass.es5libs?.map((/** @type {string} */ src) => `<script src="${src}"></script>`).join('\n') || '<!-- no es5libs -->'}
    </head>
    <body>
        <div id="app">
            <div id="appInner">
                <!--A link without href, which makes it invisible. Setting href in an example would trigger a download when clicked.-->
                ${exampleClass.INCLUDE_AR_LINK ? `<div style="width:100%; position:absolute; top:10px">
                    <div style="text-align: center;">
                        <a id="ar-link" rel="ar" download="asset.usdz">
                            <img src="./arkit.png" id="button" width="200"/>
                        </a>    
                    </div>
                </div>` : ''}
                ${exampleClass.NO_CANVAS ? '' : '<canvas id="application-canvas"></canvas>'}
            </div>
        </div>
        <script src='./playcanvas-observer.js'></script>
        <script src='./pathes.js'></script>
        <!-- imports (if any) -->
        <script>
${exampleClass.imports?.map((/** @type {{ toString: () => any; }} */ _) => _.toString()).join('\n\n') || ''}
        </script>
        <!-- controls (if given) -->
        <script>
${exampleClass.controls?.toString() || ''}
        </script>
        <script>
${exampleClass.example.toString()}
        </script>
        <script>
        const ENGINE_PATH = '${process.env.ENGINE_PATH ?? ''}';
        const NODE_ENV = '${process.env.NODE_ENV ?? ''}';
        /**
         * Used in outline and posteffects to make ES5 scripts work in ES6
         * @example
         * // doesn't start with 'class', so not changing any behaviour
         * debugger; // step through with F11 to debug
         * Object.prototype.toString.call(1) === '[object Number]'
         */
        function enablePolyfillFunctionCall() {
            const functionCall = Function.prototype.call;
            function polyCall(thisArg, ...args) {
                if (this.toString().startsWith('class')) {
                    return Object.assign(thisArg, new this(...args));
                }
                return functionCall.bind(this)(thisArg, ...args);
            }
            Function.prototype.call = polyCall;
        }
        enablePolyfillFunctionCall();
        /**
         * Can load UMD and ESM. UMD registers itself into globalThis, while ESM is handled
         * to specifically to do the same, so we achieve the same result, no matter which
         * target build/src we linked to.
         */
        async function loadScript(name, src) {
            // console.log('loadScript>', { name, src });
            const module = await import(src);
            const isESM = Object.keys(module).length;
            if (isESM) {
                window[name] = module;
            }
        }
        /**
         * @returns {string}
         */
        function getDeviceType() {
            const last = localStorage.getItem('preferredGraphicsDevice');
            if (last !== null) {
                if (last === 'webgpu' && ${exampleClass.WEBGPU_ENABLED === false}) {
                    console.warn('Picked WebGPU but example is not supported on WebGPU, defaulting to WebGL2');
                    return 'webgl2';
                }
                return last;
            } else if (${Boolean(exampleClass.WEBGPU_ENABLED)}) {
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
         * Get the specified engine, picking the right choice from three sources:
         *  - Example#ENGINE (lowest priority)
         *  - NODE_ENV (2nd lowest priority)
         *  - ENGINE_PATH (highest priority)
         * If none of these sources are given, we simply pick build/playcanvas.js (ES5)
         */
        function getSpecifiedEngine() {
            let specifiedEngine = '${engineFor(exampleClass.ENGINE)}';
            // Doesn't matter what Example class specifies otherwise, because
            // NODE_ENV has a higher priority
            if (NODE_ENV === 'development') {
                specifiedEngine = '${engineFor('DEBUG')}'
            }
            // ENGINE_PATH has the highest priority.
            if (ENGINE_PATH.length) {
                const entryPoint = ENGINE_PATH.split('/').pop();
                specifiedEngine = './ENGINE_PATH/' + entryPoint;
            }
            return specifiedEngine;
        }
        let app;
        let ready = false; // Used in indicate if UI can render Controls
        let started = false;
        let miniStats;
        let allowRestart = 'true';
        const args = Object.fromEntries(
            location.href.split('?').pop().split('#')[0].split('&').map(_ => _.split('='))
        );
        let data = new observer.Observer({});
        /**
         * Keep it function in first run for nicer debug locations.
         * @type {Record<string, string | Function>}
         */
        const files = {};
        files['example.mjs'] = example.toString();
        if (window.controls) {
            files['controls.mjs'] = controls.toString();
        }
        var filesObject = ${exampleClass.FILES ? JSON.stringify(exampleClass.FILES) : '{}'};
        function resolveFunction(_) {
            if (_.call) {
                return _;
            }
            return new Function('return ' + _)();
        }
        Object.assign(files, filesObject);
        function requestFiles() {
            const responseEvent = new CustomEvent("requestedFiles", { detail: files });
            window.top.dispatchEvent(responseEvent);
        }
        /**
         * This function is called from React whenever we click on MiniStats icon,
         * even PlayCanvas' pc itself could be undefined here.
         */
        function showStats() {
            // examples/misc/mini-stats.mjs creates its own instance of ministats, prevent two mini-stats here
            if (${!!exampleClass.NO_MINISTATS}) {
                return;
            }
            if (typeof pc === 'undefined' || typeof pcx === 'undefined') {
                return;
            }
            const deviceType = app?.graphicsDevice?.deviceType;
            if (deviceType === 'null') {
                return;
            }
            if (args.miniStats === 'false') {
                return;
            }
            if (!miniStats) {
                miniStats = new pcx.MiniStats(app);
            }
            miniStats.enabled = true;
        }
        function hideStats() {
            if (!miniStats) {
                return;
            }
            miniStats.enabled = false;
        }
        /**
         * This function is called from React whenever we change an example in any possible state,
         * even PlayCanvas' pc itself could be undefined here.
         */
        function destroy() {
            miniStats?.destroy();
            miniStats = null;
            // Can't call app.destroy() twice without an error,
            // so we check for app.graphicsDevice first
            if (app && app.graphicsDevice) {
                app.destroy();
            }
            ready = false;
        }
        function hotReload() {
            if (!allowRestart) {
                console.warn('hotReload> Dropping restart while still restarting');
                return;
            }
            destroy();
            data = new observer.Observer({});
            main(files);
        }
        window.addEventListener('requestFiles', requestFiles);
        window.addEventListener('showStats'   , showStats   );
        window.addEventListener('hideStats'   , hideStats   );
        window.addEventListener('destroy'     , destroy     );
        window.addEventListener('hotReload'   , hotReload   );
        function updateControls() {
            const event = new CustomEvent("updateFiles", {
                detail: {
                    files
                }
            });
            window.top.dispatchEvent(event);
        }
        function updateActiveDevice() {
            const event = new CustomEvent("updateActiveDevice", {
                detail: app.graphicsDevice.deviceType
            });
            window.top.dispatchEvent(event);
        }
        async function main(files) {
            allowRestart = false;
            await loadScript('pc', getSpecifiedEngine());
            await loadScript('pcx', './playcanvas-extras.js');
            window.top.pc = pc;
            var canvas = document.getElementById("application-canvas");
            window.top.observerData = data;
            var deviceType = getDeviceType();
            if (args.deviceType) {
                console.warn("overwriting default deviceType from URL");
                deviceType = args.deviceType;
            }
            if (!deviceType) {
                console.warn("No deviceType given, defaulting to WebGL2");
                deviceType = 'webgl2';
            }
            if (!started) {
                // console.log("Dispatch exampleLoading!");
                // just notify to clean UI, but not during hot-reload
                const event = new CustomEvent("exampleLoading", {
                    detail: {
                        showDeviceSelector: ${!exampleClass.NO_DEVICE_SELECTOR},
                    }
                });
                window.top.dispatchEvent(event);
            }
            const example = resolveFunction(files['example.mjs']);
            files['example.mjs'] = files['example.mjs'].toString();
            app = await example({
                canvas,
                deviceType,
                data,
                assetPath,
                scriptsPath,
                ammoPath,
                basisPath,
                dracoPath,
                glslangPath,
                twgslPath,
                pcx,
                files,
            });
            ready = true;
            class ExampleLoadEvent extends CustomEvent {
                constructor(deviceType) {
                    super("exampleLoad");
                    this.files = files;
                    this.description = ${JSON.stringify(exampleClass.DESCRIPTION || '')};
                }
            }
            const finalFunc = () => {
                if (app.graphicsDevice?.canvas) {
                    showStats();
                    if (!started) { // only one time, recalls of main() are caused by Monaco live coding
                        window.top.dispatchEvent(new ExampleLoadEvent());
                    }
                    started = true;
                    updateControls();
                    updateActiveDevice();
                    allowRestart = true;
                } else {
                    console.warn('main> no canvas');
                }
            };
            // Wait until example has called app.start()
            // And if it already called start, we will know by app.frame > 0
            // app.start() is called when assets loaded in examples
            if (app) {
                if (app.frame) { // app already started
                    finalFunc();
                } else { // Wait for app.start()
                    app.once('start', finalFunc);
                }
            } else {
                // The example function didn't return an app instance
                // still update the UI and assume it has started.
                window.top.dispatchEvent(new ExampleLoadEvent());
                started = true;
                updateControls();
                allowRestart = true;
            }
        }
        window.onload = () => main(files);
        </script>
    </body>
</html>`;
}
