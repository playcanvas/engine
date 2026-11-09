// @config
//
// Digital rain on gaussian splats, some of which become glyphs.
//
// @credit
// title: SA3D_R&D_XP47
// author: Stephane Agullo
// source: https://superspl.at/view?id=cdcec084
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSPLAT_RENDERER_AUTO,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { GSplatGlyphRainShaderEffect } from 'playcanvas/scripts/esm/gsplat/shader-effect-glyph-rain.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

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

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assets = {
    apartment: new Asset('apartment', 'gsplat', { url: './assets/splats/apartment.sog' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', GSPLAT_RENDERER_AUTO);

// The base values, PlayCanvas orange glyphs with warm white drop heads, which the presets override
const BASE = {
    glyph: {
        percent: 8,
        size: 0.04,
        snap: true,
        swaps: 1.5,
        brightness: 1.5,
        glow: 0.15,
        shading: 0.6,
        opacity: 1,
        color: [1, 0.4, 0],
        head: [1, 0.85, 0.7]
    },
    rain: { speed: 15, trail: 14, spacing: 50, head: 1 },
    fall: { distance: 0, speed: 0.3 },
    others: { density: 0.5, maxSize: 0.003, opacity: 0.6, brightness: 0.25, tint: 1, rain: 0.5 },
    turb: { amount: 0, scale: 0.5, speed: 0.5, room: 0 },
    post: { bloom: 0.04, blurLevel: 6 }
};

/**
 * Creates the preset values, keyed by their data path.
 *
 * @param {object} overrides - The values overriding the base values, by group.
 * @returns {Object<string, number|boolean|number[]>} The preset values.
 */
const createPreset = (overrides) => {
    /** @type {Object<string, number|boolean|number[]>} */
    const values = {};
    for (const [group, base] of Object.entries(BASE)) {
        for (const [key, value] of Object.entries({ ...base, ...overrides[group] })) {
            values[`${group}.${key}`] = value;
        }
    }
    return values;
};

// The presets, in the order of their names in the controls, as overrides of the base values
const PRESETS = [
    // None - the original scene
    createPreset({
        glyph: { percent: 0 },
        others: { density: 1, maxSize: 1, opacity: 1, brightness: 1, tint: 0, rain: 0 },
        post: { bloom: 0 }
    }),

    // Neon Cyan
    createPreset({
        glyph: { brightness: 3.3, color: [0, 0.85, 1], head: [0.85, 1, 1] },
        rain: { speed: 22, trail: 18 },
        post: { bloom: 0.06 }
    }),

    // Ghost Room - the room in its own colors, haunted by a few glyphs wandering like dust
    createPreset({
        glyph: { percent: 3, swaps: 0.5, glow: 0.05 },
        rain: { speed: 6, trail: 30, spacing: 80 },
        fall: { distance: 0.3, speed: 0.1 },
        others: { density: 1, maxSize: 0.03, opacity: 0.7, brightness: 0.55, tint: 0.35, rain: 0.8 },
        turb: { amount: 0.5, scale: 0.6, speed: 0.38, room: 0.1 },
        post: { bloom: 0.03 }
    }),

    // Snowfall - pale glyphs in a blizzard over the room in its own colors
    createPreset({
        glyph: {
            percent: 4,
            size: 0.03,
            snap: false,
            swaps: 0.2,
            brightness: 1.2,
            glow: 0.7,
            shading: 0.2,
            color: [0.85, 0.92, 1],
            head: [1, 1, 1]
        },
        rain: { trail: 10, head: 0 },
        fall: { distance: 1.5, speed: 0.15 },
        others: { density: 1, maxSize: 0.05, opacity: 1, brightness: 0.6, tint: 0.15, rain: 0 },
        turb: { amount: 0.333, scale: 0.3, speed: 0.5, room: 0 },
        post: { bloom: 0.03 }
    }),

    // Deep Sea - teal glyphs rising like bubbles through a blue room swaying as if under water
    createPreset({
        glyph: {
            percent: 4,
            size: 0.035,
            snap: false,
            swaps: 0.5,
            glow: 0.3,
            color: [0.05, 0.55, 0.75],
            head: [0.7, 1, 1]
        },
        rain: { speed: 5, trail: 25, spacing: 90 },
        fall: { distance: 1.2, speed: -0.15 },
        others: { density: 1, maxSize: 0.02, opacity: 0.8, brightness: 0.35, tint: 0.85, rain: 0.6 },
        turb: { amount: 0.05, scale: 0.8, speed: 0.3, room: 1 },
        post: { bloom: 0.05 }
    }),

    // Hologram - a monochrome deep red room swept by short bright bands, shimmering like an
    // unstable projection
    createPreset({
        glyph: { percent: 3, size: 0.025, glow: 0.3, color: [0.45, 0.01, 0.03], head: [1, 0.55, 0.45] },
        rain: { speed: 12, trail: 4, spacing: 20 },
        others: { density: 1, maxSize: 0.008, opacity: 0.45, brightness: 0.5, tint: 1, rain: 1.5 },
        turb: { amount: 0.015, scale: 0.15, speed: 2, room: 1 },
        post: { bloom: 0.06 }
    }),

    // Uplink - blue glyphs rising a short way through a blue tinted room
    createPreset({
        glyph: {
            percent: 12,
            size: 0.03,
            snap: true,
            swaps: 2.6,
            brightness: 2.22,
            glow: 0.5,
            shading: 0.6,
            opacity: 1,
            color: [0.2, 0.6, 1],
            head: [0.9, 0.95, 1]
        },
        rain: { speed: 18.3, trail: 16, spacing: 77, head: 0.62 },
        fall: { distance: 0.33, speed: -0.6 },
        others: { density: 0.5, maxSize: 0.037, opacity: 0.46, brightness: 0.35, tint: 0.69, rain: 0.5 },
        post: { bloom: 0.05, blurLevel: 6 }
    })
];

// All parameters set by the presets, and the ones which fade on a log scale
const PARAMS = Object.keys(PRESETS[0]);
const LOG_PARAMS = new Set(['others.maxSize']);

// The values used for rendering, which fade from their values at the time a preset was picked
/** @type {Object<string, any>} */
const rendered = {};
/** @type {Object<string, any>|null} */
let fadeFrom = null;
let fadeTime = 0;
let holdTime = 0;

const applyPreset = () => {
    fadeFrom = { ...rendered };
    fadeTime = 0;
    holdTime = 0;
    for (const [path, value] of Object.entries(PRESETS[data.get('preset')])) {
        if (Array.isArray(value)) {
            // a picked color is stored as an object (see read), which the observer would merge
            // into rather than replace, and the color picker cannot show
            if (!Array.isArray(data.get(path))) {
                data.unset(path);
            }
            data.set(path, value.slice());
        } else {
            data.set(path, value);
        }
    }
};

const nextPreset = () => {
    data.set('preset', (data.get('preset') + 1) % PRESETS.length);
};

for (const group of Object.keys(BASE)) {
    data.set(group, {});
}
data.set('animate', true);
data.set('fadeDuration', 2);
data.set('holdDuration', 3);
data.set('autoPlay', true);
data.set('preset', 0); // None

// start on the preset, without a fade, so auto play holds it for the hold duration
applyPreset();
fadeFrom = null;
data.on('preset:set', applyPreset);

// Auto play moves on to the next preset straight away
data.on('autoPlay:set', (/** @type {boolean} */ value) => {
    if (value) {
        nextPreset();
    }
});

const apartment = new Entity('apartment');
apartment.addComponent('gsplat', { asset: assets.apartment });
apartment.setLocalPosition(0, -0.5, -3);
apartment.setLocalEulerAngles(180, 0, 0);
apartment.setLocalScale(0.5, 0.5, 0.5);
app.root.addChild(apartment);

// The digital rain effect, whose properties are set from the faded preset values every frame
apartment.addComponent('script');
const glyphRain = /** @type {GSplatGlyphRainShaderEffect} */ (apartment.script?.create(GSplatGlyphRainShaderEffect));

// Camera positions
const cameraPos = new Vec3(-0.98, 0.28, -2.31);
const focusPos = new Vec3(-1.1, 0.13, -1.56);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: 90,
    clearColor: new Color(0, 0, 0)
});
camera.setLocalPosition(cameraPos);
camera.lookAt(focusPos);
app.root.addChild(camera);

// orbit and fly: drag to orbit, right drag to look around, WASD / QE to move (shift fast, ctrl slow)
camera.addComponent('script');
camera.script.create(CameraControls, {
    properties: {
        focusPoint: focusPos,
        pitchRange: new Vec2(-90, 90),
        moveSpeed: 1.5,
        moveFastSpeed: 6,
        moveSlowSpeed: 0.4
    }
});

// Bloom makes the drop heads glow
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.samples = 1;
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;

/**
 * Blends a parameter between its value when the fade started and its current value.
 *
 * @param {string} path - The data path of the parameter.
 * @param {any} from - The value when the fade started, undefined when not fading.
 * @param {any} to - The current value.
 * @param {number} t - The fade progress, 0 to 1.
 * @returns {any} The blended value.
 */
const blend = (path, from, to, t) => {
    if (from === undefined) return to;
    if (Array.isArray(to)) return to.map((v, i) => (from[i] ?? v) + (v - (from[i] ?? v)) * t);
    if (typeof to === 'boolean') return t < 0.5 ? from : to;
    if (LOG_PARAMS.has(path)) {
        const a = Math.log(Math.max(from, 1e-4));
        const b = Math.log(Math.max(to, 1e-4));
        return Math.exp(a + (b - a) * t);
    }
    return from + (to - from) * t;
};

/**
 * Reads a parameter. A color set by the color picker, which lives in the parent window, is not
 * an array of this window, so the observer stores it as an object with keys 0, 1 and 2.
 *
 * @param {string} path - The data path of the parameter.
 * @returns {any} The value, with colors as arrays.
 */
const read = (path) => {
    const value = data.get(path);
    return value !== null && typeof value === 'object' ? [value[0], value[1], value[2]] : value;
};

let bloom = -1;
let blurLevel = -1;

app.on('update', (dt) => {
    // fade the rendered values towards the current values
    let t = 1;
    if (fadeFrom) {
        fadeTime += dt;
        const duration = data.get('fadeDuration');
        t = duration > 0 ? Math.min(fadeTime / duration, 1) : 1;
        if (t >= 1) fadeFrom = null;
    }
    const s = t * t * (3 - 2 * t);
    for (const path of PARAMS) {
        rendered[path] = blend(path, fadeFrom?.[path], read(path), s);
    }

    // auto play holds each preset once it has faded in
    if (data.get('autoPlay') && !fadeFrom) {
        holdTime += dt;
        if (holdTime >= data.get('holdDuration')) {
            nextPreset();
        }
    }

    const r = rendered;
    glyphRain.animate = data.get('animate');
    glyphRain.glyphFraction = r['glyph.percent'] / 100;
    glyphRain.glyphSize = r['glyph.size'];
    glyphRain.snapToGrid = r['glyph.snap'];
    glyphRain.swapRate = r['glyph.swaps'];
    glyphRain.glyphBrightness = r['glyph.brightness'];
    glyphRain.restingGlow = r['glyph.glow'];
    glyphRain.sceneShading = r['glyph.shading'];
    glyphRain.glyphOpacity = r['glyph.opacity'];
    glyphRain.glyphColor.fromArray(r['glyph.color']);
    glyphRain.headColor.fromArray(r['glyph.head']);
    glyphRain.rainSpeed = r['rain.speed'];
    glyphRain.trailLength = r['rain.trail'];
    glyphRain.dropSpacing = r['rain.spacing'];
    glyphRain.headIntensity = r['rain.head'];
    glyphRain.fallDistance = r['fall.distance'];
    glyphRain.fallSpeed = r['fall.speed'];
    glyphRain.otherDensity = r['others.density'];
    glyphRain.otherMaxSize = r['others.maxSize'];
    glyphRain.otherOpacity = r['others.opacity'];
    glyphRain.otherBrightness = r['others.brightness'];
    glyphRain.otherTint = r['others.tint'];
    glyphRain.otherRainResponse = r['others.rain'];
    glyphRain.turbulence = r['turb.amount'];
    glyphRain.turbulenceScale = r['turb.scale'];
    glyphRain.turbulenceSpeed = r['turb.speed'];
    glyphRain.turbulenceOthers = r['turb.room'];

    // the camera frame is updated only when the bloom changes
    if (r['post.bloom'] !== bloom || Math.round(r['post.blurLevel']) !== blurLevel) {
        bloom = r['post.bloom'];
        blurLevel = Math.round(r['post.blurLevel']);
        cameraFrame.bloom.intensity = bloom;
        cameraFrame.bloom.blurLevel = blurLevel;
        cameraFrame.update();
    }

    // stats
    data.set('data.stats.gsplats', app.stats.frame.gsplats.toLocaleString());
});

app.on('destroy', () => {
    cameraFrame.destroy();
});
