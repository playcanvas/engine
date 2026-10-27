// @config
//
// A reference grid with every setting of the Grid script. Lower Depth Offset to see the dark plane
// hide it, and pick the SuperSplat preset to see it hide gaussian splats with Depth Write.
//
// `LMB` Orbit · `RMB` Pan · `Wheel` / `Pinch` Zoom

import {
    AppBase,
    AppOptions,
    BoundingBox,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FloatPacking,
    GSplatComponentSystem,
    GSplatContainer,
    GSplatFormat,
    Keyboard,
    LightComponentSystem,
    Mouse,
    PROJECTION_PERSPECTIVE,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { Grid } from 'playcanvas/scripts/esm/grid.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { Material } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // splats are expensive multisampled, and the grid antialiases itself
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.keyboard = new Keyboard(window);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

app.start();

/**
 * @param {Color} color - The color.
 * @returns {Material} - The standard material.
 */
const createColorMaterial = (color) => {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
};

// Scene settings
app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Create entities, half through the grid
const box = new Entity('box');
box.addComponent('render', {
    type: 'box',
    material: createColorMaterial(new Color(0.8, 1, 1))
});
box.setPosition(1, 0, 1);
app.root.addChild(box);

// A splat sphere for the SuperSplat preset, colored by direction and shaded
const SPLAT_COUNT = 6000;
const SPLAT_SIZE = 0.025;
const splatFormat = GSplatFormat.createSimpleFormat(device);
const container = new GSplatContainer(device, SPLAT_COUNT, splatFormat);
const centerTex = container.getTexture('dataCenter');
const colorTex = container.getTexture('dataColor');
const centerData = centerTex.lock();
const colorData = colorTex.lock();
const lightDir = new Vec3(0.5, 0.8, 0.3).normalize();
const n = new Vec3();
for (let i = 0; i < SPLAT_COUNT; i++) {
    // fibonacci spiral
    const y = 1 - (2 * (i + 0.5)) / SPLAT_COUNT;
    const r = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    n.set(Math.cos(a) * r, y, Math.sin(a) * r);

    // color by direction, lit from one side
    const shade = 0.15 + 0.35 * Math.max(n.dot(lightDir), 0);
    const rgb = [0.55 + 0.45 * n.x, 0.55 + 0.45 * n.y, 0.55 + 0.45 * n.z].map((c) => c * shade);

    centerData.set([n.x * 0.5, n.y * 0.5, n.z * 0.5, SPLAT_SIZE], i * 4);
    for (let c = 0; c < 3; c++) {
        colorData[i * 4 + c] = FloatPacking.float2Half(rgb[c]);
    }
    colorData[i * 4 + 3] = FloatPacking.float2Half(1);
    container.centers.set([n.x * 0.5, n.y * 0.5, n.z * 0.5], i * 3);
}
centerTex.unlock();
colorTex.unlock();
container.aabb = new BoundingBox(Vec3.ZERO, new Vec3(0.5 + SPLAT_SIZE, 0.5 + SPLAT_SIZE, 0.5 + SPLAT_SIZE));
container.update(SPLAT_COUNT);

const splatSphere = new Entity('splat-sphere');
splatSphere.addComponent('gsplat', {
    unified: true
});
splatSphere.gsplat.resource = container;
splatSphere.setPosition(-1, 0, 1);
splatSphere.enabled = false;
app.root.addChild(splatSphere);

const sphere = new Entity('sphere');
sphere.addComponent('render', {
    type: 'sphere',
    material: createColorMaterial(new Color(1, 0.8, 1))
});
sphere.setPosition(-1, 0, 1);
app.root.addChild(sphere);

// A plane on the grid, hiding it without a Depth Offset
const plane = new Entity('plane');
plane.addComponent('render', {
    type: 'plane',
    material: createColorMaterial(new Color(0.35, 0.35, 0.3))
});
plane.setPosition(-1, 0, -1);
plane.setLocalScale(1.5, 1, 1.5);
app.root.addChild(plane);

const capsule = new Entity('capsule');
capsule.addComponent('render', {
    type: 'capsule',
    material: createColorMaterial(new Color(0.8, 0.8, 1))
});
capsule.setPosition(1, 0, -1);
app.root.addChild(capsule);

// Camera
const camera = new Entity('camera');
camera.addComponent('script');
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1),
    farClip: 1000
});
const cameraOffset = 4 * camera.camera.aspectRatio;
camera.setPosition(cameraOffset, cameraOffset, cameraOffset);
app.root.addChild(camera);

// Camera controls
const cc = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(cc, {
    focusPoint: Vec3.ZERO,
    sceneSize: 5,
    rotateDamping: 0.95,
    moveDamping: 0.95,
    zoomDamping: 0.95,
    pitchRange: new Vec2(-89.999, 89.999),
    zoomRange: new Vec2(0.5, 500),
    enableFly: false
});

// Create light entity
const light = new Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// Grid, sized by its scale when not infinite
const gridEntity = new Entity('grid');
gridEntity.setLocalScale(20, 1, 20);
gridEntity.addComponent('script');
app.root.addChild(gridEntity);
const grid = /** @type {Grid} */ (gridEntity.script.create(Grid));

data.set('grid', {
    enabled: grid.enabled,
    plane: grid.plane,
    spacing: grid.spacing,
    subdivisions: grid.subdivisions,
    infinite: grid.infinite,
    size: [20, 20],
    majorLineThickness: grid.majorLineThickness,
    minorLineThickness: grid.minorLineThickness,
    axisLineThickness: grid.axisLineThickness,
    showAxes: grid.showAxes,
    contrast: grid.contrast,
    colorX: grid.colorX.toArray(),
    colorY: grid.colorY.toArray(),
    colorZ: grid.colorZ.toArray(),
    majorLineColor: grid.majorLineColor.toArray(),
    minorLineColor: grid.minorLineColor.toArray(),
    fadeStart: grid.fadeRange.x,
    fadeEnd: grid.fadeRange.y,
    depthOffset: grid.depthOffset,
    depthTest: grid.depthTest,
    depthWrite: grid.depthWrite,
    depthDither: grid.depthDither
});
// Presets, applied through the panel so its controls follow
const PRESETS = {
    default: {
        plane: 'xz',
        spacing: 10,
        subdivisions: 10,
        infinite: true,
        size: [20, 20],
        fadeStart: 400,
        fadeEnd: 1000,
        showAxes: true,
        axisLineThickness: 2,
        majorLineThickness: 1.5,
        minorLineThickness: 1,
        contrast: false,
        colorX: [1, 0.3, 0.3, 1],
        colorY: [0.3, 1, 0.3, 1],
        colorZ: [0.3, 0.3, 1, 1],
        majorLineColor: [0.8, 0.8, 0.8, 0.6],
        minorLineColor: [0.6, 0.6, 0.6, 0.4],
        depthOffset: 0.001,
        depthTest: true,
        depthWrite: false,
        depthDither: false
    },
    editor: {
        plane: 'xz',
        spacing: 1,
        subdivisions: 1,
        infinite: false,
        size: [8, 8],
        fadeStart: 400,
        fadeEnd: 1000,
        showAxes: true,
        axisLineThickness: 1,
        majorLineThickness: 1,
        minorLineThickness: 1,
        contrast: false,
        colorX: [0, 0, 0, 1],
        colorY: [0, 0, 0, 1],
        colorZ: [0, 0, 0, 1],
        majorLineColor: [136 / 255, 136 / 255, 136 / 255, 1],
        minorLineColor: [136 / 255, 136 / 255, 136 / 255, 1],
        depthOffset: 0,
        depthTest: true,
        depthWrite: false,
        depthDither: false
    },
    supersplat: {
        plane: 'xz',
        spacing: 10,
        subdivisions: 10,
        infinite: true,
        size: [20, 20],
        fadeStart: 400,
        fadeEnd: 1000,
        showAxes: true,
        axisLineThickness: 2,
        majorLineThickness: 1.5,
        minorLineThickness: 1,
        contrast: false,
        colorX: [1, 0.2, 0.2, 1],
        colorY: [0.2, 1, 0.2, 1],
        colorZ: [0.2, 0.2, 1, 1],
        majorLineColor: [0.9, 0.9, 0.9, 1],
        minorLineColor: [0.7, 0.7, 0.7, 1],
        depthOffset: 0,
        depthTest: true,
        depthWrite: true,
        depthDither: true
    }
};
data.set('preset', 'default');

data.set('camera', {
    proj: PROJECTION_PERSPECTIVE + 1,
    farClip: camera.camera.farClip
});

// Controls hook
const COLORS = ['colorX', 'colorY', 'colorZ', 'majorLineColor', 'minorLineColor'];
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const [category, key] = path.split('.');
    switch (category) {
        case 'grid': {
            // vector inputs set one component at a time
            const v = data.get(`grid.${key}`);
            if (key === 'size' || key === 'plane') {
                // size is the entity's scale on the plane's axes
                const [w, d] = data.get('grid.size');
                const plane = data.get('grid.plane');
                grid.plane = plane;
                gridEntity.setLocalScale(
                    plane === 'yz' ? 1 : w,
                    plane === 'xz' ? 1 : plane === 'xy' ? d : w,
                    plane === 'xy' ? 1 : d
                );
            } else if (key === 'fadeStart' || key === 'fadeEnd') {
                // the sliders set the range's ends
                grid.fadeRange = new Vec2(data.get('grid.fadeStart'), data.get('grid.fadeEnd'));
            } else if (key === 'contrast') {
                // contrast needs the scene color map
                camera.camera.renderSceneColorMap = v;
                grid.contrast = v;
            } else if (COLORS.includes(key)) {
                // @ts-ignore
                grid[key] = new Color().fromArray(v);
            } else {
                // @ts-ignore
                grid[key] = v;
            }
            break;
        }
        case 'preset': {
            const preset = PRESETS[/** @type {keyof typeof PRESETS} */ (value)];
            for (const [name, v] of Object.entries(preset ?? {})) {
                data.set(`grid.${name}`, v);
            }

            // splats only with the SuperSplat preset
            splatSphere.enabled = value === 'supersplat';
            sphere.enabled = !splatSphere.enabled;
            break;
        }
        case 'camera': {
            switch (key) {
                case 'proj': {
                    camera.camera.projection = value - 1;
                    break;
                }
                case 'farClip': {
                    camera.camera.farClip = value;
                    break;
                }
            }
            break;
        }
    }
});

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
resize();

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});
