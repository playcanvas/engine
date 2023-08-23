import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as realExamples from "../src/examples/index.mjs";
import { toKebabCase } from '../src/app/helpers/strings.mjs';
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;
const exampleData = {};
if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/`);
}
for (const category_ in realExamples) {
    const category = toKebabCase(category_);
    exampleData[category] = {};
    const examples = realExamples[category_];
    for (const exampleName_ in examples) {        
        const exampleClass = examples[exampleName_];
        const example = toKebabCase(exampleName_).replace('-example', '');
        exampleData[category][example] = {};
        const exampleFunc = exampleClass.example.toString();
        exampleData[category][example].example = exampleFunc;
        exampleData[category][example].nameSlug = example;
        exampleData[category][example].categorySlug = category;
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
 * @param {string} category - The category.
 * @param {string} example - The example.
 * @param {object} exampleClass - The example class.
 * @param {object} ministats - Should ministats be enabled?
 * @returns {string} File to write as standalone example.
 */
function generateExampleFile(category, example, exampleClass) {
    return `<html>
    <head>
        <link rel="stylesheet" href="./example.css">
        <!--<link rel="stylesheet" href="../styles.css">-->
        <title>${category}: ${example}</title>
        ${exampleClass.es5libs?.map(_ => `<script src="${_}"></script>`).join('\n') || '<!-- no es5libs -->'}
    </head>
    <body>
        <div id="app">
            <div id="appInner">
                <!--A link without href, which makes it invisible. Setting href in an example would trigger a download when clicked.-->
                <div style="width:100%; position:absolute; top:10px">
                    <div style="text-align: center;">
                        <a id="ar-link" rel="ar" download="asset.usdz">
                            <img src="./arkit.png" id="button" width="200"/>
                        </a>    
                    </div>
                </div>
                <canvas id='application-canvas'></canvas>
            </div>
        </div>
        <script src='./playcanvas.js'></script>
        <script src='./playcanvas-extras.js'></script>
        <script src='./playcanvas-observer.js'></script>
        <script src='./pathes.js'></script>
        <!-- imports (if any) -->
        <script>
${exampleClass.imports?.map(_ => _.toString()).join('\n\n') || ''}
        </script>
        <!-- controls (if given) -->
        <script>
${exampleClass.controls?.toString() || ''}
        </script>
        <script>
${exampleClass.example.toString()}
        </script>
        <script>
        window.top.pc = pc;
        /**
         * @returns {string}
         */
        function getDeviceType() {
            if (${Boolean(exampleClass.WEBGPU_ENABLED)}) {
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
        let started = false;
        const data = new observer.Observer({});
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
        async function main(files) {
            var canvas = document.getElementById("application-canvas");
            window.top.observerData = data;
            var args = Object.fromEntries(
                location.href.split('?').pop().split('#')[0].split('&').map(_ => _.split('='))
            );
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
                const event = new CustomEvent("exampleLoading"); // just notify to clean UI, but not during hot-reload
                window.top.dispatchEvent(event);
            }
            const example = resolveFunction(files['example.mjs']);
            files['example.mjs'] = files['example.mjs'].toString();
            const app = await example({
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
            window.app = app;
            function resize() {
                const w = window.innerWidth;
                const h = window.innerHeight;
                // console.log("resize", w, h);
                app.resizeCanvas(w, h);
            }
            /**
             * @param {pc.AppBase} app - The application.
             */
            function setupApplication(app) {
                const canvas = app.graphicsDevice.canvas;
                // handle resizing
                var canvasContainerElement = canvas.parentElement;
                canvas.setAttribute('width', window.innerWidth + 'px');
                canvas.setAttribute('height', window.innerHeight + 'px');
                app.setCanvasResolution(pc.RESOLUTION_AUTO);
                window.onresize = resize;
                const deviceType = app.graphicsDevice.deviceType;
                if (deviceType !== 'webgpu' && deviceType !== 'null' && ${Boolean(exampleClass.MINISTATS)}) {
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
            class ExampleLoadEvent extends CustomEvent {
                /** @type {string} */
                deviceType;
                /**
                 * @param {string} deviceType
                 */
                constructor(deviceType) {
                    super("exampleLoad");
                    this.deviceType = deviceType;
                    this.files = files;
                }
            }
            const finalFunc = () => {
                // console.log("REAL START!");
                if (app.graphicsDevice?.canvas) {
                    setupApplication(app);
                    if (!started) { // only one time, recalls of main() are caused by Monaco live coding
                        const event = new ExampleLoadEvent(app.graphicsDevice.deviceType);
                        window.top.dispatchEvent(event);
                    }
                    started = true;
                } else {
                    console.warn("no canvas")
                }
            };
            // Wait until example has called app.start()
            // And if it already called start, we will know by app.frame > 0
            // app.start() is called when assets loaded in examples
            if (app.frame) { // app already started
                finalFunc();
            } else { // Wait for app.start()
                app.once('start', finalFunc);
            }
        }
        window.onload = () => main(files);
        </script>
    </body>
</html>`;
}
