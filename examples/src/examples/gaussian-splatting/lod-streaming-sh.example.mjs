// @config
//
// Demonstrates LOD streaming combined with spherical harmonics for view-dependent effects.
//
// @credit
// title: Skatepark
// author: Christoph Schindelar
// source: https://superspl.at/user?id=schindelar3d

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
    GSPLAT_DEBUG_NONE,
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
    Keyboard,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice,
    platform
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GSplatRevealGridEruption } from 'playcanvas/scripts/esm/gsplat/reveal-grid-eruption.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // Disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is updated when window changes size
const onResize = () => {
    app.resizeCanvas();
    // With on-demand rendering (autoRender is set to false once the reveal completes), a resize is
    // a viewport change the app makes itself — it does not raise 'frame:request' — so request a
    // render to draw the scene at the new canvas size.
    app.renderNextFrame = true;
};
window.addEventListener('resize', onResize);
app.on('destroy', () => {
    window.removeEventListener('resize', onResize);
});

// Skatepark configuration
const config = {
    name: 'Skatepark',
    url: 'https://code.playcanvas.com/examples_data/example_skatepark_02/lod-meta.json',
    lodUpdateDistance: 1,
    lodUnderfillLimit: 10,
    cameraPosition: [32, 2, 2],
    eulerAngles: [-90, 0, 0],
    moveSpeed: 4,
    moveFastSpeed: 15,
    enableOrbit: false,
    enablePan: false,
    focusPoint: [0, 0.6, 0]
};

// LOD preset definitions with customizable distances
/** @type {Record<string, { range: number[], lodBaseDistance: number }>} */
const LOD_PRESETS = {
    'desktop-max': {
        range: [0, 5],
        lodBaseDistance: 15
    },
    desktop: {
        range: [0, 2],
        lodBaseDistance: 15
    },
    'mobile-max': {
        range: [1, 2],
        lodBaseDistance: 15
    },
    mobile: {
        range: [2, 5],
        lodBaseDistance: 15
    }
};

const assets = {
    church: new Asset('gsplat', 'gsplat', { url: config.url }),

    envatlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/table-mountain-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Setup skydome
app.scene.skyboxMip = 1;
app.scene.exposure = 1.5;

// Enable rotation-based LOD updates and behind-camera penalty
app.scene.gsplat.lodUpdateAngle = 90;
app.scene.gsplat.lodBehindPenalty = 2;
app.scene.gsplat.radialSorting = true;
app.scene.gsplat.lodUpdateDistance = config.lodUpdateDistance;
app.scene.gsplat.lodUnderfillLimit = config.lodUnderfillLimit;

// Set up SH update parameters
app.scene.gsplat.colorUpdateAngle = 10;

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});

// Initialize UI settings
data.set('renderer', GSPLAT_RENDERER_AUTO);
data.set('debug', GSPLAT_DEBUG_NONE);
data.set('lodPreset', platform.mobile ? 'mobile' : 'desktop');
data.set('splatBudget', platform.mobile ? 1 : 3);

data.on('debug:set', () => {
    app.scene.gsplat.debug = data.get('debug');
});

const entity = new Entity(config.name || 'gsplat');
entity.addComponent('gsplat', {
    asset: assets.church
});
entity.setLocalPosition(0, 0, 0);
const [rotX, rotY, rotZ] = /** @type {[number, number, number]} */ (config.eulerAngles || [-90, 0, 0]);
entity.setLocalEulerAngles(rotX, rotY, rotZ);
entity.setLocalScale(1, 1, 1);
app.root.addChild(entity);
const gs = /** @type {any} */ (entity.gsplat);

const applyPreset = () => {
    const preset = data.get('lodPreset');
    const presetData = LOD_PRESETS[preset] || LOD_PRESETS.desktop;
    gs.lodRangeMin = presetData.range[0];
    gs.lodRangeMax = presetData.range[1];
    gs.lodBaseDistance = presetData.lodBaseDistance;
    data.set('lodBaseDistance', presetData.lodBaseDistance);
};

applyPreset();
data.on('lodPreset:set', applyPreset);

data.set('lodMultiplier', 4);
gs.lodMultiplier = 4;

data.on('lodBaseDistance:set', () => {
    gs.lodBaseDistance = data.get('lodBaseDistance');
});
data.on('lodMultiplier:set', () => {
    gs.lodMultiplier = data.get('lodMultiplier');
});

const applySplatBudget = () => {
    const millions = data.get('splatBudget');
    app.scene.gsplat.splatBudget = Math.round(millions * 1000000);
};

applySplatBudget();
data.on('splatBudget:set', applySplatBudget);

// Create a camera with fly controls
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    fov: 75,
    toneMapping: TONEMAP_ACES
});

// Set camera position
const [camX, camY, camZ] = /** @type {[number, number, number]} */ (config.cameraPosition);
const [focusX, focusY, focusZ] = /** @type {[number, number, number]} */ (config.focusPoint || [0, 0.6, 0]);
const focusPoint = new Vec3(focusX, focusY, focusZ);

camera.setLocalPosition(camX, camY, camZ);

app.root.addChild(camera);

// Add the GSplatRevealGridEruption script to the gsplat entity
entity.addComponent('script');
const revealScript = entity.script?.create(GSplatRevealGridEruption);
if (revealScript) {
    revealScript.center.set(focusX, focusY, focusZ);
    revealScript.blockCount = 6;
    revealScript.blockSize = 4;
    revealScript.delay = 0.2;
    revealScript.duration = 0.7;
    revealScript.dotSize = 0.01;
    revealScript.endRadius = 35;
}

camera.addComponent('script');
const cc = /** @type { CameraControls} */ (/** @type {any} */ (camera.script).create(CameraControls));
Object.assign(cc, {
    sceneSize: 500,
    moveSpeed: /** @type {number} */ (config.moveSpeed),
    moveFastSpeed: /** @type {number} */ (config.moveFastSpeed),
    enableOrbit: config.enableOrbit ?? false,
    enablePan: config.enablePan ?? false,
    focusPoint: focusPoint
});

// --- On-demand rendering demo -----------------------------------------------------------
// Gaussian-splat streaming (LOD evaluation + file loading) runs every frame regardless of
// rendering. We render continuously while the reveal animation plays, then switch to rendering
// only on demand: when streaming has new data to show (the 'frame:request' event) or when the
// camera moves. This lets an otherwise-idle app keep loading splats in the background while
// staying GPU-idle until there's something new to draw.

// Render whenever streaming produced new data (or a CPU sort result became ready to apply)
app.systems.gsplat.on('frame:request', () => {
    app.renderNextFrame = true;
});

let revealPlaying = true;
const lastCamPos = new Vec3();
const lastCamRot = new Quat();

app.on('update', () => {
    // Update HUD stats
    data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());

    if (revealPlaying) {
        // The reveal script disables itself when its animation completes; once that happens,
        // stop rendering every frame and switch to on-demand rendering.
        if (revealScript && !revealScript.enabled) {
            revealPlaying = false;
            app.autoRender = false;

            // The reveal finishing is a draw-state change (it ends the per-frame splat masking),
            // not a streaming change, so it does not raise 'frame:request'. Render one final
            // frame so the fully-revealed scene — including the far environment/sky splats, which
            // the eruption reveals last — is shown before we go idle.
            app.renderNextFrame = true;

            lastCamPos.copy(camera.getPosition());
            lastCamRot.copy(camera.getRotation());
        }
    } else {
        // Keep the fly camera interactive: render when it has moved or rotated this frame
        const pos = camera.getPosition();
        const rot = camera.getRotation();
        if (!pos.equals(lastCamPos) || !rot.equals(lastCamRot)) {
            app.renderNextFrame = true;
            lastCamPos.copy(pos);
            lastCamRot.copy(rot);
        }
    }
});
