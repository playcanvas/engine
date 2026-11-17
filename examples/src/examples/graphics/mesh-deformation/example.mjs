// @config
//
// The vertex positions of the statue's meshes are modified on the CPU every frame.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_VSM_16F,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Dark studio look: the environment only provides soft ambient light, the skybox itself is hidden
const backgroundColor = new Color(0.035, 0.04, 0.06);
app.scene.skyboxMip = 2;
app.scene.exposure = 1;
app.scene.skyboxIntensity = 0.35;
app.scene.envAtlas = assets.helipad.resource;
app.scene.layers.getLayerByName('Skybox').enabled = false;

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: backgroundColor,
    fov: 40
});
app.root.addChild(camera);

// Tone mapping, bloom and vignette
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.bloom.intensity = 0.02;
cameraFrame.vignette.intensity = 0.6;
cameraFrame.update();

// Create a hierarchy of entities with render components, representing the statue model
const entity = assets.statue.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(entity);

// World space bounds of the statue, used to frame the camera
const bounds = new BoundingBox();
/** @type {Array<RenderComponent>} */
const renders = entity.findComponents('render');
let first = true;
renders.forEach((render) => {
    render.meshInstances.forEach((mi) => {
        if (first) {
            bounds.copy(mi.aabb);
            first = false;
        } else {
            bounds.add(mi.aabb);
        }
    });
});
const height = bounds.halfExtents.y * 2;

// Key light with soft self-shadowing
const key = new Entity('key');
key.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.93, 0.82),
    intensity: 2.2,
    castShadows: true,
    shadowResolution: 2048,
    shadowType: SHADOW_VSM_16F,
    vsmBlurSize: 15,
    shadowDistance: height * 4,
    shadowBias: 0.2,
    normalOffsetBias: 0.1
});
key.setLocalEulerAngles(50, 35, 0);
app.root.addChild(key);

// Cool rim light from behind
const rim = new Entity('rim');
rim.addComponent('light', {
    type: 'directional',
    color: new Color(0.35, 0.55, 1),
    intensity: 1.6
});
rim.setLocalEulerAngles(20, 215, 0);
app.root.addChild(rim);

// Collect positions from all mesh instances to work on
/** @type {object[]} */
const allMeshes = [];
renders.forEach((render) => {
    // Collect positions from all mesh instances on this render component
    const meshInstances = render.meshInstances;
    for (let i = 0; i < meshInstances.length; i++) {
        const meshInstance = meshInstances[i];

        // Get positions from the mesh
        const mesh = meshInstance.mesh;
        /** @type {number[]} */
        const srcPositions = [];
        mesh.getPositions(srcPositions);

        // Store it
        allMeshes.push({
            mesh: mesh,
            srcPositions: srcPositions
        });
    }
});

// Temporary work array of positions to avoid per frame allocations
/** @type {number[]} */
const tempPositions = [];

// The statue is anchored at its base: the deformation grows towards the top
let minY = Infinity;
let maxY = -Infinity;
allMeshes.forEach(({ srcPositions }) => {
    for (let k = 1; k < srcPositions.length; k += 3) {
        minY = Math.min(minY, srcPositions[k]);
        maxY = Math.max(maxY, srcPositions[k]);
    }
});
const range = maxY - minY;
const strength = range * 0.09;

let time = 0;
app.on('update', (dt) => {
    time += dt;

    // Orbit the camera
    const r = height * 1.9;
    camera.setLocalPosition(r * Math.sin(time * 0.15), height * 0.7, r * Math.cos(time * 0.15));
    camera.lookAt(new Vec3(bounds.center.x, bounds.center.y - height * 0.05, bounds.center.z));

    // Modify mesh positions on each frame
    for (let i = 0; i < allMeshes.length; i++) {
        tempPositions.length = 0;
        const srcPositions = allMeshes[i].srcPositions;

        // A wave travels up the statue, displacing .x and .z components (a circular sway), with
        // the amount growing towards the top
        for (let k = 0; k < srcPositions.length; k += 3) {
            const y = srcPositions[k + 1];
            const t = (y - minY) / range;
            const phase = time * 1.5 + t * 4;
            const amount = strength * t * t;
            tempPositions[k] = srcPositions[k] + amount * Math.sin(phase);
            tempPositions[k + 1] = y;
            tempPositions[k + 2] = srcPositions[k + 2] + amount * Math.cos(phase);
        }

        // Set new positions on the mesh
        const mesh = allMeshes[i].mesh;
        mesh.setPositions(tempPositions);
        mesh.update();
    }
});
