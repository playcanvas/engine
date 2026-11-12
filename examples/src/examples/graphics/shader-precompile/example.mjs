// @config DESCRIPTION Many StandardMaterial variants, each needing its own shaders. With precompile enabled, the shaders and render pipelines are prepared before the first frame, and after adding materials, so that they compile in parallel, with a progress bar. The camera sits inside a ring of objects, so most of them start outside of its view. The shaders are made unique on each run, so that the browser cannot reuse previously compiled ones.
import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    DITHER_BAYER8,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    Vec2,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    color: new Asset('color', 'texture', { url: './assets/textures/seaside-rocks01-color.jpg' }, { srgb: true }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' }),
    ao: new Asset('ao', 'texture', { url: './assets/textures/seaside-rocks01-ao.jpg' }),
    alpha: new Asset(
        'alpha',
        'texture',
        { url: './assets/textures/seaside-rocks01-diffuse-alpha.png' },
        { srgb: true }
    ),
    emissive: new Asset('emissive', 'texture', { url: './assets/textures/heart.png' }, { srgb: true }),
    checker: new Asset('checker', 'texture', { url: './assets/textures/checkboard.png' }, { srgb: true })
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// Precompile and its frustum culling are kept between loads of the example. Adding materials uses
// them right away, while the loading of the example uses them from its next load, as it precompiles
// before its first frame
const PRECOMPILE = 'pc-examples-shader-precompile-enabled';
const FRUSTUM_CULLING = 'pc-examples-shader-precompile-frustum-culling';
data.set('settings', {
    precompile: localStorage.getItem(PRECOMPILE) !== 'false',
    frustumCulling: localStorage.getItem(FRUSTUM_CULLING) === 'true',
    rotate: true
});
data.set('reloadHint', '');
data.on('settings.precompile:set', (/** @type {boolean} */ value) => {
    localStorage.setItem(PRECOMPILE, `${value}`);
    data.set('reloadHint', 'Reload to apply');
});
data.on('settings.frustumCulling:set', (/** @type {boolean} */ value) => {
    localStorage.setItem(FRUSTUM_CULLING, `${value}`);
    data.set('reloadHint', 'Reload to apply');
});
data.set('stats', { shaders: '', pipelines: '', time: '', stalls: '0 ms' });

// set while a precompile runs, which reports its own time
let precompiling = false;

// The number of shaders and render pipelines, updated each frame, so that they can be seen compiling
// one by one without precompile. WebGL has no render pipelines.
// The compile stalls are the time the rendering waits for compilation: the frames creating shaders or
// render pipelines, and the few after them, take longer than usual - on WebGL the frame waits for the
// shaders to link, on WebGPU the following frames wait for the browser to compile the pipelines. Their
// time over a usual frame is accumulated.
const resourceCounts = new Map();
let lastCounts = '';
let lastFrameTime = 0;
let usualFrameTime = 1000 / 60;
let stallFrames = 0;
let stallTime = 0;
app.on('frameend', () => {
    const time = performance.now();
    const frameTime = lastFrameTime ? time - lastFrameTime : usualFrameTime;
    lastFrameTime = time;

    resourceCounts.clear();
    device.getResourceCounts(resourceCounts);
    const shaders = `${resourceCounts.get('shaders') ?? 0}`;
    const pipelines = `${resourceCounts.get('renderPipelines') ?? '-'}`;
    if (data.get('stats.shaders') !== shaders) data.set('stats.shaders', shaders);
    if (data.get('stats.pipelines') !== pipelines) data.set('stats.pipelines', pipelines);

    const counts = `${shaders}|${pipelines}`;
    if (counts !== lastCounts && !precompiling) {
        stallFrames = 4;
    }
    lastCounts = counts;

    if (stallFrames > 0) {
        stallFrames--;
        stallTime += Math.max(0, frameTime - usualFrameTime);
        data.set('stats.stalls', `${stallTime.toFixed(0)} ms`);
    } else if (!precompiling) {
        usualFrameTime += (frameTime - usualFrameTime) * 0.1;
    }
});

app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.6;

// A value unique to this run, compiled into every shader of the materials, so that the browser and
// the graphics driver cannot reuse the shaders they compiled on a previous run, which would hide
// the cost of compiling them. A variable initialized to it and written in each shader stage is kept
// by the shader compilers.
const runSeed = `${(1 + Math.random()).toFixed(9)}e-30`;

/**
 * Makes the shaders of a material unique to this run, see runSeed.
 *
 * @param {StandardMaterial} material - The material.
 */
const makeShadersUnique = (material) => {
    const glsl = material.getShaderChunks(SHADERLANGUAGE_GLSL);
    glsl.set('litUserDeclarationVS', `float pcRunSeed = ${runSeed};`);
    glsl.set('litUserMainStartVS', 'pcRunSeed += 1.0;');
    glsl.set('litUserDeclarationPS', `float pcRunSeed = ${runSeed};`);
    glsl.set('litUserMainStartPS', 'pcRunSeed += 1.0;');

    const wgsl = material.getShaderChunks(SHADERLANGUAGE_WGSL);
    wgsl.set('litUserDeclarationVS', `var<private> pcRunSeed: f32 = ${runSeed};`);
    wgsl.set('litUserMainStartVS', 'pcRunSeed = pcRunSeed + 1.0;');
    wgsl.set('litUserDeclarationPS', `var<private> pcRunSeed: f32 = ${runSeed};`);
    wgsl.set('litUserMainStartPS', 'pcRunSeed = pcRunSeed + 1.0;');
};

// each feature changes the shaders of a material
const tex = Object.fromEntries(Object.entries(assets).map(([name, asset]) => [name, asset.resource]));

/** @type {((material: StandardMaterial) => void)[]} */
const features = [
    (m) => {
        m.diffuseMap = tex.color;
    },
    (m) => {
        m.normalMap = tex.normal;
    },
    (m) => {
        m.aoMap = tex.ao;
    },
    (m) => {
        m.useMetalness = true;
        m.metalness = 0.8;
        m.metalnessMap = tex.ao;
    },
    (m) => {
        m.clearCoat = 0.8;
        m.clearCoatGloss = 0.9;
    },
    (m) => {
        m.useSheen = true;
        m.sheen = new Color(0.8, 0.3, 0.3);
    },
    (m) => {
        m.useIridescence = true;
        m.iridescence = 1;
        m.iridescenceThicknessMax = 600;
    },
    (m) => {
        m.emissiveMap = tex.emissive;
        m.emissive = new Color(1, 1, 1);
    },
    (m) => {
        m.opacityMap = tex.alpha;
        m.alphaTest = 0.5;
    },
    (m) => {
        m.blendType = BLEND_NORMAL;
        m.opacity = 0.6;
        m.depthWrite = false;
    },
    (m) => {
        m.glossMap = tex.ao;
    },
    (m) => {
        m.enableGGXSpecular = true;
        m.anisotropyIntensity = 0.8;
    },
    (m) => {
        m.diffuseDetailMap = tex.checker;
        m.diffuseDetailMapTiling = new Vec2(4, 4);
    },
    (m) => {
        m.cull = CULLFACE_NONE;
        m.twoSidedLighting = true;
    },
    (m) => {
        m.opacityDither = DITHER_BAYER8;
        m.opacity = 0.7;
    },
    (m) => {
        m.refraction = 0.5;
        m.refractionIndex = 1 / 1.5;
    }
];

// a deterministic random sequence, so each run creates the same materials
let seed = 1234;
const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};

const usedMasks = new Set();

/**
 * Returns a combination of features not used yet.
 *
 * @returns {number} The bit mask of the features.
 */
const nextMask = () => {
    for (;;) {
        let mask = 0;
        const count = 3 + Math.floor(random() * 3);
        for (let i = 0; i < count; i++) {
            mask |= 1 << Math.floor(random() * features.length);
        }
        if (!usedMasks.has(mask)) {
            usedMasks.add(mask);
            return mask;
        }
    }
};

let ringIndex = 0;

/**
 * Adds a ring of objects around the camera, each with a material of its own combination of
 * features.
 *
 * @param {number} count - The number of objects.
 */
const addRing = (count) => {
    const radius = 7;
    const y = ringIndex * 1.6;
    for (let i = 0; i < count; i++) {
        const material = new StandardMaterial();
        material.diffuse = new Color(0.3 + 0.7 * random(), 0.3 + 0.7 * random(), 0.3 + 0.7 * random());
        material.gloss = 0.4 + 0.5 * random();
        const mask = nextMask();
        features.forEach((feature, index) => {
            if (mask & (1 << index)) {
                feature(material);
            }
        });
        makeShadersUnique(material);
        material.update();

        // the rows are offset by half a step, so that the spheres of the neighboring rows interleave
        const angle = ((i + (ringIndex % 2) * 0.5) / count) * Math.PI * 2;
        const entity = new Entity(`ring${ringIndex}-${i}`);
        entity.addComponent('render', {
            type: 'sphere',
            material: material
        });
        entity.setLocalPosition(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
        entity.setLocalScale(1.3, 1.3, 1.3);
        entity.setLocalEulerAngles(random() * 360, random() * 360, 0);
        app.root.addChild(entity);
    }
    ringIndex++;
};

addRing(24);
addRing(24);

const ground = new Entity('ground');
const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.4, 0.4, 0.45);
makeShadersUnique(groundMaterial);
groundMaterial.update();
ground.addComponent('render', { type: 'plane', material: groundMaterial });
ground.setLocalScale(30, 1, 30);
ground.setLocalPosition(0, -0.9, 0);
app.root.addChild(ground);

const camera = new Entity('camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_NEUTRAL,
    fov: 60
});
camera.setLocalPosition(0, 0.8, 0);
app.root.addChild(camera);

const sun = new Entity('sun');
sun.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowResolution: 2048,
    shadowDistance: 30,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
sun.setLocalEulerAngles(50, 30, 0);
app.root.addChild(sun);

const lamp = new Entity('lamp');
lamp.addComponent('light', {
    type: 'omni',
    color: new Color(1, 0.8, 0.6),
    range: 14,
    intensity: 2,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
lamp.setLocalPosition(0, 4, 0);
app.root.addChild(lamp);

// A progress bar displayed while the shaders compile. It is an HTML element, as the application
// renders nothing until they finish compiling.
const progressPanel = document.createElement('div');
progressPanel.style.cssText =
    'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:320px;padding:16px;' +
    'background:rgba(0,0,0,0.75);border-radius:8px;color:#fff;font:14px sans-serif;display:none;';
const progressLabel = document.createElement('div');
progressLabel.style.cssText = 'margin-bottom:8px;';
const progressTrack = document.createElement('div');
progressTrack.style.cssText = 'height:8px;background:rgba(255,255,255,0.2);border-radius:4px;overflow:hidden;';
const progressBar = document.createElement('div');
progressBar.style.cssText = 'height:100%;width:0;background:#f60;';
progressTrack.appendChild(progressBar);
progressPanel.append(progressLabel, progressTrack);
document.body.appendChild(progressPanel);

app.on('precompile:start', () => {
    progressBar.style.width = '0';
    progressLabel.textContent = 'Compiling shaders… 0%';
    progressPanel.style.display = 'block';
});
app.on('precompile:progress', (/** @type {number} */ progress) => {
    progressBar.style.width = `${progress * 100}%`;
    progressLabel.textContent = `Compiling shaders… ${Math.round(progress * 100)}%`;
});
app.on('precompile:end', () => {
    progressPanel.style.display = 'none';
});
app.on('destroy', () => {
    progressPanel.remove();
});

/**
 * Prepares the shaders the next frame needs, when enabled, and reports the result.
 *
 * @param {string} step - What is being prepared.
 */
const precompile = (step) => {
    if (!data.get('settings.precompile')) {
        data.set('stats.time', 'off');
        return;
    }
    data.set('stats.time', 'compiling');
    precompiling = true;
    app.precompile({ frustumCulling: data.get('settings.frustumCulling') }).then((stats) => {
        data.set('stats.time', stats ? `${stats.time.toFixed(0)} ms` : '-');

        // the frames right after count towards the stalls, which on WebGL include the completion of
        // the compilation the browser defers to the first draw of a shader, see AppBase#precompile
        precompiling = false;
        stallFrames = 4;
        if (stats) {
            console.log(
                `Precompile ${step}: ${stats.shaders} shaders, ${stats.pipelines} pipelines, ${stats.time.toFixed(0)} ms`
            );
        }
    });
};

data.on('add', () => {
    addRing(24);
    precompile('Added materials');
});

let yaw = 0;
app.on('update', (/** @type {number} */ dt) => {
    if (data.get('settings.rotate')) {
        yaw += dt * 15;
        camera.setLocalEulerAngles(0, yaw, 0);
    }
});

precompile('Loading');
app.start();

export { app };
