// @config
//
// Demonstrates streaming an XGRIDS LCC2 level of detail scene of Gaussian Splats.
//
// @credit
// title: Tunis
// author: Andrii Shramko
// source: https://www.youtube.com/watch?v=DlyWh0a_eaA

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSPLATDATA_COMPACT,
    GSPLAT_DEBUG_NONE,
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
    Keyboard,
    MiniStats,
    Mouse,
    RESOLUTION_AUTO,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_LINEAR,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice,
    platform
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);

// treat DPR >= 2 as high-DPI and render at half of it
const dpr = window.devicePixelRatio || 1;
device.maxPixelRatio = dpr >= 2 ? dpr * 0.5 : dpr;

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [CameraComponentSystem, ScriptComponentSystem, GSplatComponentSystem];
// the splat files are SOG bundles, whose data loads as textures
createOptions.resourceHandlers = [TextureHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// LOD preset definitions. The ranges end past any scene's coarsest level, so the range clamps to
// the scene's own levels and distant parts can always use its coarsest ones.
/** @type {Record<string, { range: number[] }>} */
const LOD_PRESETS = {
    'desktop-max': {
        range: [0, 20]
    },
    desktop: {
        range: [1, 20]
    },
    'mobile-max': {
        range: [2, 20]
    },
    mobile: {
        range: [3, 20]
    }
};

// The `.lcc2` file describes the level of detail tree, and its splat files are streamed on demand
const assets = {
    tunis: new Asset('tunis', 'gsplat', {
        url: 'https://code.playcanvas.com/examples_data/tunis_01/03-19-195651.lcc2'
    })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

const miniStats = new MiniStats(app, MiniStats.getDefaultOptions(['gsplats', 'gsplatsCopy', 'compute']));

// The streaming settings of the streamed-sog example
app.scene.gsplat.lodUpdateAngle = 90;
app.scene.gsplat.lodUpdateDistance = 0.5;
app.scene.gsplat.lodUnderfillLimit = 5;
app.scene.gsplat.lodBehindPenalty = 3;
app.scene.gsplat.radialSorting = true;
app.scene.gsplat.dataFormat = GSPLATDATA_COMPACT;
app.scene.gsplat.minPixelSize = 2;
app.scene.gsplat.minContribution = 3;

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.on('debug:set', () => {
    app.scene.gsplat.debug = data.get('debug');
});

const applySplatBudget = () => {
    app.scene.gsplat.splatBudget = Math.round(data.get('splatBudget') * 1000000);
};
data.on('splatBudget:set', applySplatBudget);

// Initialize UI settings (must be after observer registration)
data.set('renderer', GSPLAT_RENDERER_AUTO);
data.set('debug', GSPLAT_DEBUG_NONE);
data.set('lodPreset', platform.mobile ? 'mobile' : 'desktop-max');
data.set('splatBudget', platform.mobile ? 1 : 4);

// The scene, stored with +Z up
const entity = new Entity('Tunis');
entity.addComponent('gsplat', {
    asset: assets.tunis
});
entity.setLocalEulerAngles(270, 0, 0);
app.root.addChild(entity);
const gsplat = /** @type {any} */ (entity.gsplat);

const applyPreset = () => {
    const presetData = LOD_PRESETS[data.get('lodPreset')] || LOD_PRESETS.desktop;
    gsplat.lodRangeMin = presetData.range[0];
    gsplat.lodRangeMax = presetData.range[1];
};

// Start with the coarsest level for a fast first view, then stream in the preset's detail
const worstLod = gsplat.resource.octree.lodLevels - 1;
gsplat.lodRangeMin = worstLod;
gsplat.lodRangeMax = worstLod;

const gsplatSystem = /** @type {any} */ (app.systems.gsplat);
const onFrameReady = (
    /** @type {any} */ cam,
    /** @type {any} */ layer,
    /** @type {boolean} */ ready,
    /** @type {number} */ loadingCount
) => {
    if (ready && loadingCount === 0) {
        gsplatSystem.off('frame:ready', onFrameReady);
        applyPreset();
        data.on('lodPreset:set', applyPreset);
    }
};
gsplatSystem.on('frame:ready', onFrameReady);

// A camera with fly controls, starting in the courtyard on the path the scene was scanned along
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(1, 1, 1),
    fov: 75,
    farClip: 10000,
    toneMapping: TONEMAP_LINEAR
});
camera.setLocalPosition(1.7, 1.7, -12.9);
app.root.addChild(camera);

camera.addComponent('script');
const cc = /** @type {CameraControls} */ (/** @type {any} */ (camera.script).create(CameraControls));
Object.assign(cc, {
    sceneSize: 500,
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false,
    focusPoint: new Vec3(2, 1.7, -22.9)
});

app.on('update', () => {
    data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
    const bb = app.graphicsDevice.backBufferSize;
    data.set('data.stats.resolution', `${bb.x} x ${bb.y}`);
});

export { miniStats };
