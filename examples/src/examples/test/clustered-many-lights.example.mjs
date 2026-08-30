// @config
//
// Tests LightingParams#maxLights, which configures how many lights the clustered lighting can use
// in a single frame. Values above 255 no longer fit in the 8 bit light index the light grid stores
// by default, and the grid switches to a 16 bit index.
//
// A 64x64 grid of 4096 omni lights is placed over a ground plane, one light per cell of the grid,
// and maxLights is set to 4096 to allow all of them. Each light is colored by its creation index,
// sweeping the hue across the grid row by row, so every light contributes a uniquely colored pool
// of light. All 4096 pools should be lit and the hue sweep should be continuous - if the light
// index was truncated, only the first 255 lights would light up.
//
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LIGHTFALLOFF_INVERSESQUARED,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_ACES,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

// number of lights along each axis of the grid, and their world space spacing
const gridSize = 64;
const spacing = 2.5;
const lightRange = 2;

const numLights = gridSize * gridSize;
const gridExtent = (gridSize - 1) * spacing;

app.scene.clusteredLightingEnabled = true;

const lighting = app.scene.lighting;

// allow this many lights in a single frame - over 255 lights the light grid stores the light
// index using 16 bits instead of 8
lighting.maxLights = numLights;

// the lights form a flat grid, so a single cell is enough vertically
lighting.cells = new Vec3(gridSize, 1, gridSize);

// with the lights spaced further apart than their range, only a handful of them overlap any cell
lighting.maxLightsPerCell = 24;

// too many lights to render shadows for
lighting.shadowsEnabled = false;

// convert a hue in the 0..1 range to a fully saturated color
const hueToColor = (hue) => {
    const h = (hue - Math.floor(hue)) * 6;
    const x = 1 - Math.abs((h % 2) - 1);
    if (h < 1) return new Color(1, x, 0);
    if (h < 2) return new Color(x, 1, 0);
    if (h < 3) return new Color(0, 1, x);
    if (h < 4) return new Color(0, x, 1);
    if (h < 5) return new Color(x, 0, 1);
    return new Color(1, 0, x);
};

// ground plane the lights shine on
const groundMaterial = new StandardMaterial();
groundMaterial.gloss = 0.4;
groundMaterial.metalness = 0.2;
groundMaterial.useMetalness = true;
groundMaterial.update();

const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'plane',
    material: groundMaterial
});
ground.setLocalScale(gridExtent + 8 * spacing, 1, gridExtent + 8 * spacing);
app.root.addChild(ground);

// a 2d grid of omni lights, colored by their creation index
for (let i = 0; i < numLights; i++) {
    const x = i % gridSize;
    const z = Math.floor(i / gridSize);

    const light = new Entity(`Light-${i}`);
    light.addComponent('light', {
        type: 'omni',
        color: hueToColor(i / numLights),
        intensity: 3,
        range: lightRange,
        castShadows: false,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED
    });
    light.setLocalPosition(x * spacing - gridExtent * 0.5, 0.6, z * spacing - gridExtent * 0.5);
    app.root.addChild(light);
}

// the camera frames the whole grid, so that no light is frustum culled and all of them are
// stored in the light grid at the same time
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.02, 0.02, 0.02),
    farClip: 1000,
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.setLocalPosition(0, 170, 185);
app.root.addChild(camera);

const cc = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cc.focusPoint = new Vec3(0, 0, 0);
