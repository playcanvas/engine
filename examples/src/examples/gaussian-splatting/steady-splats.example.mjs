// @config
//
// Compare SteadySplats importance resampling with native stochastic and sorted GSplat rendering.
// Native stochastic uses the engine's default blue-noise dither without temporal filtering.
// SteadySplats temporal retention trades response for stability.
// The minimal resampling path supports splat-only, full-viewport mono perspective views;
// unsupported views and WebGL retain sorted rendering.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSPLAT_RENDERER_RASTER_CPU_SORT,
    GSPLAT_RENDERER_RASTER_GPU_SORT,
    GSPLAT_RENDERER_STEADY,
    GSplatComponentSystem,
    GSplatHandler,
    Mouse,
    RESOLUTION_AUTO,
    ScriptComponentSystem,
    ScriptHandler,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],
    antialias: false
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const options = new AppOptions();
options.graphicsDevice = device;
options.mouse = new Mouse(document.body);
options.touch = new TouchDevice(document.body);
options.componentSystems = [CameraComponentSystem, ScriptComponentSystem, GSplatComponentSystem];
options.resourceHandlers = [TextureHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(options);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

const assets = {
    biker: new Asset('biker', 'gsplat', { url: './assets/splats/biker.compressed.ply' }),
    orbit: new Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' })
};
await new Promise((resolve, reject) => {
    new AssetListLoader(Object.values(assets), app.assets).load((error) => (error ? reject(error) : resolve()));
});

// Script instances created below initialize immediately, as in the other GSplat examples.
app.start();

const biker = new Entity('Biker');
biker.addComponent('gsplat', { asset: assets.biker });
biker.setLocalEulerAngles(180, 90, 0);
app.root.addChild(biker);

const camera = new Entity('Camera');
camera.addComponent('camera', { clearColor: new Color(0.08, 0.08, 0.08) });
camera.addComponent('script');
app.root.addChild(camera);
const orbit = /** @type {any} */ (
    camera.script.create('orbitCamera', {
        attributes: { inertiaFactor: 0, distanceMax: 60, frameOnStart: false }
    })
);
orbit.pivotPoint.copy(new Vec3(0, 1.4, 0));
orbit.reset(32, -10, 5);
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');

const renderers = {
    steady: GSPLAT_RENDERER_STEADY,
    stochastic: GSPLAT_RENDERER_RASTER_GPU_SORT,
    'gpu-sort': GSPLAT_RENDERER_RASTER_GPU_SORT,
    'cpu-sort': GSPLAT_RENDERER_RASTER_CPU_SORT
};
data.on('mode:set', () => {
    const mode = data.get('mode');
    app.scene.gsplat.stochastic = mode === 'stochastic' && device.isWebGPU;
    app.scene.gsplat.renderer = renderers[mode];
    // Show the resolved WebGL fallback for both WebGPU-only modes.
    const current = app.scene.gsplat.currentRenderer;
    if (current !== renderers[mode]) {
        setTimeout(() => data.set('mode', 'cpu-sort'), 0);
    }
});
data.on('historyWeight:set', () => {
    app.scene.gsplat.steadyHistoryWeight = data.get('historyWeight');
    app.scene.gsplat.resetHistory();
});
data.set('mode', 'steady');
data.set('historyWeight', 0.7);

// SteadySplats inference does not change model training. Four cached occluders approximate
// proposal-density ratios; finite histories and self-normalization leave residual error.
// See Windisch et al., https://arxiv.org/abs/2610.05576 (Eq. 9, 14, 20; Algorithms 2 and 3).
