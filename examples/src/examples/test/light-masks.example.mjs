// @config
// @flag HIDDEN

// Light masks: which lights affect lightmapped geometry, dynamic geometry, or only the lightmap.
//
// A light carries three independent mask bits, and only two of them act at runtime:
//
//   MASK_BAKE               contributes to the lightmap during baking, invisible at runtime
//   MASK_AFFECT_LIGHTMAPPED lights lightmapped objects at runtime
//   MASK_AFFECT_DYNAMIC     lights everything else at runtime
//
// A mesh instance sits on one side or the other, never both: the lightmapper stamps every baked
// instance with MASK_AFFECT_LIGHTMAPPED, and everything else keeps the default MASK_AFFECT_DYNAMIC.
// A light reaches an object only when the two masks overlap.
//
// Renderer-side, the lights surviving an object's mask are packed into numbered shader slots
// (light0_*, light1_* ...) starting at zero, so a slot denotes a *different* light depending on
// which mask is being drawn. The four groups below are deliberately created in an order that makes
// the two runtime masks disagree about slot numbering, which is what this example exists to cover:
//
//   group             mask  slots seen by a lightmapped object   by a dynamic object
//   dynamic only         1  -                                   0
//   lightmapped only     2  0                                   -
//   affect all           3  1                                   1
//
// Neither mask gets a gap-free view here, which is the awkward case. Keep the creation order as it
// is - reordering these lights so one mask sees a contiguous run makes the example stop testing the
// thing it is for.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BAKE_COLOR,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Lightmapper,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.lightmapper = Lightmapper;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [ScriptHandler];

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

app.start();

// keep it dark, so each light's contribution is unambiguous
app.scene.ambientLight = new Color(0.05, 0.05, 0.06);

const material = new StandardMaterial();
material.gloss = 0.5;
material.metalness = 0.2;
material.useMetalness = true;
material.update();

// ground plane, lightmapped - so it shows the baked contribution as well as the runtime lights
// allowed to touch lightmapped geometry
const ground = new Entity('ground');
ground.addComponent('render', {
    castShadows: false,
    castShadowsLightmap: true,
    lightmapped: true,
    type: 'plane',
    material: material
});
app.root.addChild(ground);
ground.setLocalScale(13, 1, 13);

// Two rows of otherwise identical objects, differing only in whether they are lightmapped. The
// back row takes the lightmap (and so MASK_AFFECT_LIGHTMAPPED), the front row stays dynamic.
const shapes = ['box', 'sphere', 'capsule', 'cone', 'cylinder'];
const rowSpacing = 2.4;

/** @type {Entity[]} */
const dynamicEntities = [];

for (let i = 0; i < shapes.length; i++) {
    const x = (i - (shapes.length - 1) / 2) * rowSpacing;

    // lightmapped (baked) row
    const baked = new Entity(`baked-${shapes[i]}`);
    baked.addComponent('render', {
        castShadows: true,
        castShadowsLightmap: true,
        lightmapped: true,
        type: shapes[i],
        material: material
    });
    app.root.addChild(baked);
    baked.setLocalPosition(x, 0.7, -2.8);

    // dynamic row - not lightmapped, so it keeps MASK_AFFECT_DYNAMIC
    const dynamic = new Entity(`dynamic-${shapes[i]}`);
    dynamic.addComponent('render', {
        castShadows: true,
        lightmapped: false,
        type: shapes[i],
        material: material
    });
    app.root.addChild(dynamic);
    dynamic.setLocalPosition(x, 0.7, 2.8);
    dynamicEntities.push(dynamic);
}

// bob the dynamic row, to make it obvious which row is lit in real time
let time = 0;
app.on('update', (dt) => {
    time += dt;
    for (let i = 0; i < dynamicEntities.length; i++) {
        const entity = dynamicEntities[i];
        const position = entity.getLocalPosition();
        entity.setLocalPosition(position.x, 0.7 + Math.sin(time * 1.5 + i * 0.7) * 0.3, position.z);
        entity.rotate(0, dt * 30, 0);
    }
});

// --- the four light groups, in the creation order described at the top of this file ---

// 1. dynamic only (mask MASK_AFFECT_DYNAMIC): reaches the front row, never the lightmapped one
const lightDynamicOnly = new Entity('light-dynamic-only');
lightDynamicOnly.addComponent('light', {
    type: 'directional',
    color: new Color(0.2, 0.4, 1.0),
    intensity: 1.3,
    affectDynamic: true,
    affectLightmapped: false,
    bake: false,
    castShadows: false
});
lightDynamicOnly.setEulerAngles(35, 30, 0);
app.root.addChild(lightDynamicOnly);

// 2. lightmapped only (mask MASK_AFFECT_LIGHTMAPPED): a real-time light that reaches the baked row
// and the ground, but not the dynamic row. Note this is *not* baked - it is evaluated every frame.
const lightLightmappedOnly = new Entity('light-lightmapped-only');
lightLightmappedOnly.addComponent('light', {
    type: 'directional',
    color: new Color(1.0, 0.25, 0.2),
    intensity: 1.0,
    affectDynamic: false,
    affectLightmapped: true,
    bake: false,
    castShadows: false
});
lightLightmappedOnly.setEulerAngles(35, -60, 0);
app.root.addChild(lightLightmappedOnly);

// 3. affect all (mask MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED): reaches both rows. This one
// casts shadows, so the per-light shadow uniforms (matrix, cascades, bias) are exercised too.
const lightAll = new Entity('light-all');
lightAll.addComponent('light', {
    type: 'directional',
    color: new Color(1.0, 0.95, 0.85),
    intensity: 0.9,
    affectDynamic: true,
    affectLightmapped: true,
    bake: false,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowResolution: 2048,
    shadowDistance: 40,
    normalOffsetBias: 0.05,
    shadowBias: 0.2
});
lightAll.setEulerAngles(42, 22, 0);
app.root.addChild(lightAll);

// 4. bake only (mask MASK_BAKE): contributes to the lightmap and nothing else. It holds no runtime
// light slot at all, so toggling it only changes anything after a re-bake.
const lightBakeOnly = new Entity('light-bake-only');
lightBakeOnly.addComponent('light', {
    type: 'omni',
    color: new Color(0.3, 1.0, 0.4),
    intensity: 4.0,
    range: 11,
    affectDynamic: false,
    affectLightmapped: false,
    bake: true,
    castShadows: true,
    shadowResolution: 512,
    shadowType: SHADOW_PCF3_32F,
    normalOffsetBias: 0.05,
    shadowBias: 0.2
});
lightBakeOnly.setLocalPosition(-3.5, 2.0, -2.8);
app.root.addChild(lightBakeOnly);

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.11, 0.13),
    farClip: 100,
    nearClip: 0.05
});
camera.setLocalPosition(0, 5, 12);
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMax: 40,
        focusEntity: ground,
        pivotPoint: new Vec3(0, 0.5, 0)
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// lightmap baking properties
app.scene.lightmapMode = BAKE_COLOR;
app.scene.lightmapMaxResolution = 2048;
app.scene.lightmapSizeMultiplier = 32;
app.scene.lightmapFilterEnabled = true;
app.scene.lightmapFilterRange = 5;
app.scene.lightmapFilterSmoothness = 0.1;

const bake = () => app.lightmapper.bake(null, BAKE_COLOR);
bake();

// GPU-generated lightmaps are lost with the device
device.on('devicerestored', () => bake());

data.on('*:set', (path, value) => {
    const name = path.split('.')[1];

    if (name === 'bakeOnly') {
        lightBakeOnly.enabled = value;
        // a baked contribution only changes when the lightmap is regenerated
        bake();
    } else if (name === 'lightmappedOnly') {
        lightLightmappedOnly.enabled = value;
    } else if (name === 'dynamicOnly') {
        lightDynamicOnly.enabled = value;
    } else if (name === 'affectAll') {
        lightAll.enabled = value;
    }
});

data.set('data', {
    bakeOnly: true,
    lightmappedOnly: true,
    dynamicOnly: true,
    affectAll: true
});

export { app };
