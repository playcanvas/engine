// @config
//
// Basic example showing a Gaussian Splat loaded from an spz file (https://github.com/nianticlabs/spz).
// The spz parser is not part of the engine - it is registered with the gsplat resource handler by
// the application.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSplatComponentSystem,
    GSplatHandler,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';
import { SpzParser } from 'playcanvas/scripts/esm/parsers/spz-parser.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up the ZSTD decompression module, used by the spz parser
WasmModule.setConfig('ZstdDecoderModule', {
    glueUrl: './assets/wasm/zstd/zstd.wasm.js',
    wasmUrl: './assets/wasm/zstd/zstd.wasm.wasm'
});

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Register the spz parser with the gsplat resource handler
const gsplatHandler = /** @type {GSplatHandler} */ (app.loader.getHandler('gsplat'));
gsplatHandler.addParser(new SpzParser(app));

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    biker: new Asset('gsplat', 'gsplat', { url: './assets/splats/biker.spz' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Note: unlike ply files, the spz file stores the splat data in the RUB coordinate system
// (y-up), so no flip rotation is needed here
const biker = new Entity('biker');
biker.addComponent('gsplat', {
    asset: assets.biker
});
app.root.addChild(biker);

const ORBIT_PIVOT = new Vec3().copy(biker.getPosition());
ORBIT_PIVOT.y += 1;
const ORBIT_DISTANCE = 6;
const ORBIT_INITIAL_YAW = 32;
const ORBIT_INITIAL_PITCH = -10;

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

camera.addComponent('script');
const orbitCam = /** @type {any} */ (
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 60,
            frameOnStart: false
        }
    })
);
if (orbitCam) {
    orbitCam.pivotPoint.copy(ORBIT_PIVOT);
    orbitCam.reset(ORBIT_INITIAL_YAW, ORBIT_INITIAL_PITCH, ORBIT_DISTANCE);
    orbitCam._updatePosition();
}
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
