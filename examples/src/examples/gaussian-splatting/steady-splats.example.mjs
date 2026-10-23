// @config
//
// Compare SteadySplats with native stochastic and sorted rendering.
// Orbit, then stop to watch noise settle. Toggle Converge at Rest to compare.
//
// @credit
// title: SteadySplats: Resampling of Low-Variance Gaussians for High-Fidelity Stochastic Rendering
// author: Felix Windisch et al. (2026)
// source: https://arxiv.org/abs/2610.05576
//
// @credit
// title: LichtFeld-Studio viewport resampling (PR #3728)
// author: Yehe Liu
// source: https://github.com/MrNeRF/LichtFeld-Studio/pull/3728
//
// @credit
// title: LichtFeld-Studio color-variance training (PR #3726)
// author: Yehe Liu
// source: https://github.com/MrNeRF/LichtFeld-Studio/pull/3726

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

// Native stochastic uses blue-noise dither without temporal filtering. Both stochastic paths
// use camera.jitter to switch between fixed and animated samples. SteadySplats uses STBN and
// progressively averages stationary views; history weight controls the moving-camera filter.
// Unsupported views or devices retain sorted rendering.

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],
    antialias: false
});

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

// Bound reconstruction memory and sample time on high-DPI displays.
const maxPixels = device.isWebGPU ? 2560 * 1600 : 1920 * 1200;
const resize = () => {
    device.maxPixelRatio = Math.min(
        window.devicePixelRatio,
        2,
        Math.sqrt(maxPixels / Math.max(1, window.innerWidth * window.innerHeight))
    );
    app.resizeCanvas();
};
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));
resize();

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
const orbit =
    /** @type {import('playcanvas').ScriptType & { pivotPoint: Vec3, reset: (yaw: number, pitch: number, distance: number) => void }} */ (
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
const updateSampling = () => {
    const mode = data.get('mode');
    const stochastic = mode === 'steady' || mode === 'stochastic';
    camera.camera.jitter = stochastic && data.get('animateSamples') ? 1 : 0;
    app.scene.gsplat.resetHistory();
};
data.on('mode:set', () => {
    const mode = data.get('mode');
    app.scene.gsplat.stochastic = mode === 'stochastic' && device.isWebGPU;
    app.scene.gsplat.renderer = renderers[mode];
    updateSampling();
    // Show the resolved device fallback when the selected renderer is unavailable.
    const current = app.scene.gsplat.currentRenderer;
    if (current !== renderers[mode]) {
        setTimeout(() => data.set('mode', 'cpu-sort'), 0);
    }
});
data.on('animateSamples:set', updateSampling);
data.on('convergence:set', () => {
    app.scene.gsplat.steadyConvergence = data.get('convergence');
});
data.on('refinementFrames:set', () => {
    app.scene.gsplat.steadyConvergenceFrames = data.get('refinementFrames');
});
data.on('historyWeight:set', () => {
    app.scene.gsplat.steadyHistoryWeight = data.get('historyWeight');
    app.scene.gsplat.resetHistory();
});
data.set('animateSamples', true);
data.set('mode', 'steady');
data.set('historyWeight', 0.7);
data.set('convergence', true);
data.set('refinementFrames', 16);
