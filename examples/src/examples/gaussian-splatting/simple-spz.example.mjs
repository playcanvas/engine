// @config
//
// Basic example showing a Gaussian Splat loaded from an spz file (https://github.com/nianticlabs/spz).
// The spz parser is not part of the engine - it is registered with the gsplat resource handler by
// the application.

import * as pc from 'playcanvas';
import { SpzParser } from 'playcanvas/scripts/esm/gsplat/spz-parser.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up the ZSTD decompression module, used by the spz parser
pc.WasmModule.setConfig('ZstdDecoderModule', {
    glueUrl: './assets/wasm/zstd/zstd.wasm.js',
    wasmUrl: './assets/wasm/zstd/zstd.wasm.wasm'
});

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// register the spz parser with the gsplat resource handler
const gsplatHandler = /** @type {pc.GSplatHandler} */ (app.loader.getHandler('gsplat'));
gsplatHandler.addParser(new SpzParser(app));

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    biker: new pc.Asset('gsplat', 'gsplat', { url: './assets/splats/biker.spz' }),
    orbit: new pc.Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // note: unlike ply files, the spz file stores the splat data in the RUB coordinate system
    // (y-up), so no flip rotation is needed here
    const biker = new pc.Entity('biker');
    biker.addComponent('gsplat', {
        asset: assets.biker
    });
    app.root.addChild(biker);

    const ORBIT_PIVOT = new pc.Vec3().copy(biker.getPosition());
    ORBIT_PIVOT.y += 1;
    const ORBIT_DISTANCE = 6;
    const ORBIT_INITIAL_YAW = 32;
    const ORBIT_INITIAL_PITCH = -10;

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2),
        toneMapping: pc.TONEMAP_ACES
    });
    app.root.addChild(camera);

    camera.addComponent('script');
    const orbitCam = /** @type {any} */ (camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 60,
            frameOnStart: false
        }
    }));
    if (orbitCam) {
        orbitCam.pivotPoint.copy(ORBIT_PIVOT);
        orbitCam.reset(ORBIT_INITIAL_YAW, ORBIT_INITIAL_PITCH, ORBIT_DISTANCE);
        orbitCam._updatePosition();
    }
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
});
