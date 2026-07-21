// @config
//
// Composes the frame from multiple layers: an x-ray layer draws a character silhouette through
// walls using a greater depth test, a character layer renders the walking character on top of
// it, and a front layer with depth clearing keeps a held item from clipping into the scene.
// Use the controls to toggle individual layers.
//
// @credit
// title: Mirror's Edge Apartment - Interior Scene
// author: Aurélien Martel
// source: https://sketchfab.com/3d-models/mirrors-edge-apartment-interior-scene-9804e9f2fe284070b081c96ceaf8af96
// license: CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/)

import {
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FUNC_GREATER,
    Keyboard,
    LAYERID_DEPTH,
    LAYERID_IMMEDIATE,
    LAYERID_SKYBOX,
    LAYERID_UI,
    LAYERID_WORLD,
    Layer,
    LightComponentSystem,
    MeshInstance,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    apartment: new Asset('apartment', 'container', { url: './assets/models/apartment.glb' }),
    bitmoji: new Asset('bitmoji', 'container', { url: './assets/models/bitmoji.glb' }),
    walk: new Asset('walk', 'container', { url: './assets/animations/bitmoji/walk.glb' }),
    cube: new Asset('cube', 'container', { url: './assets/models/playcanvas-cube.glb' }),
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
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(window);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    AnimComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, AnimClipHandler, AnimStateGraphHandler];

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

// Setup skydome for environment lighting
app.scene.envAtlas = assets.helipad.resource;
app.scene.exposure = 1.2;

// ------ Layer setup ------

const worldLayer = app.scene.layers.getLayerByName('World');

// The 'X-Ray' layer renders after the World layer's opaque meshes. Meshes placed in it draw on
// top of what the World layer rendered, which this example combines with a greater depth test
// to show a character silhouette through walls. It is inserted before the World layer's
// transparent sublayer, so that transparent meshes (which do not write depth) still render on
// top of the silhouette.
const xrayLayer = new Layer({ name: 'X-Ray' });
app.scene.layers.insert(xrayLayer, app.scene.layers.getTransparentIndex(worldLayer));

// The 'Character' layer renders the character normally, after the X-Ray layer. Keeping the
// character out of the World layer means the x-ray depth test only compares against the world
// geometry, and rendering it after the X-Ray layer paints the visible parts of the character
// over the silhouette.
const characterLayer = new Layer({ name: 'Character' });
app.scene.layers.insert(characterLayer, app.scene.layers.getTransparentIndex(worldLayer));

// The 'Front' layer renders last and clears the depth buffer before drawing, so its meshes are
// never clipped by the world geometry - useful for held items or 3D HUD elements.
const frontLayer = new Layer({ name: 'Front', clearDepthBuffer: true });
app.scene.layers.push(frontLayer);

// ------ Scene setup ------

// Create an instance of the apartment and add it to the scene
const apartmentEntity = assets.apartment.resource.instantiateRenderEntity();
apartmentEntity.setLocalScale(30, 30, 30);
app.root.addChild(apartmentEntity);

// Add a concrete pillar between the camera and the walking path, to demonstrate the x-ray
// effect when the character walks behind it
const pillarMaterial = new StandardMaterial();
pillarMaterial.diffuse.set(0.58, 0.57, 0.55);
pillarMaterial.gloss = 0.3;
pillarMaterial.update();

const pillar = new Entity('Pillar');
pillar.addComponent('render', {
    type: 'box',
    material: pillarMaterial
});
pillar.setLocalScale(20, 240, 20);
pillar.setLocalPosition(-160, 120, -62);
app.root.addChild(pillar);

// A root entity moved along a path each frame, carrying both copies of the walking character
const walkerRoot = new Entity('WalkerRoot');
app.root.addChild(walkerRoot);

// The character is rendered normally in the Character layer
const walker = assets.bitmoji.resource.instantiateRenderEntity();
walker.setLocalScale(60, 60, 60);
walkerRoot.addChild(walker);
walker.addComponent('anim', { activate: true });
walker.anim.assignAnimation('Walk', assets.walk.resource.animations[0].resource);
walker.findComponents('render').forEach((render) => {
    render.layers = [characterLayer.id];
});

// Flat emissive material with a greater depth test - it only passes where the character is
// behind already rendered geometry, so the silhouette shows only when occluded
const xrayMaterial = new StandardMaterial();
xrayMaterial.diffuse.set(0, 0, 0);
xrayMaterial.emissive.set(1.2, 0.2, 0.25);
xrayMaterial.depthFunc = FUNC_GREATER;
xrayMaterial.depthWrite = false;
xrayMaterial.update();

// Render the character a second time into the X-Ray layer, by adding mesh instances to it
// directly. These share the mesh, node and skin instance with the normal copy, so they render
// in the exact same pose, and the greater depth test only passes where the character is hidden
// behind the world geometry.
const xrayMeshInstances = [];
walker.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((meshInstance) => {
        const xrayInstance = new MeshInstance(meshInstance.mesh, xrayMaterial, meshInstance.node);
        xrayInstance.skinInstance = meshInstance.skinInstance;
        xrayInstance.morphInstance = meshInstance.morphInstance;
        xrayMeshInstances.push(xrayInstance);
    });
});
xrayLayer.addMeshInstances(xrayMeshInstances);

// Create an Entity with a camera component, rendering the default layers as well as the two
// newly created layers
const cameraEntity = new Entity('Camera');
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1),
    farClip: 1500,
    fov: 80,
    layers: [
        LAYERID_WORLD,
        LAYERID_DEPTH,
        LAYERID_SKYBOX,
        LAYERID_IMMEDIATE,
        LAYERID_UI,
        xrayLayer.id,
        characterLayer.id,
        frontLayer.id
    ]
});

cameraEntity.setLocalPosition(-318, 114, -59);
app.root.addChild(cameraEntity);

// Add orbit camera controls, focused on the center of the walking path
cameraEntity.addComponent('script');
const cameraControls = /** @type {CameraControls} */ (cameraEntity.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(-60, 45, -15);
cameraControls.zoomRange = new Vec2(30, 600);

// PlayCanvas cube in the Front layer, attached to the camera like a held item. Because the
// Front layer clears the depth buffer, the cube is never clipped by nearby walls.
const cubeEntity = assets.cube.resource.instantiateRenderEntity();
cubeEntity.findComponents('render').forEach((render) => {
    render.layers = [frontLayer.id];
});
cubeEntity.setLocalScale(12, 12, 12);
cubeEntity.setLocalPosition(28, -22, -60);
cameraEntity.addChild(cubeEntity);

// ------ UI handling ------

data.on('*:set', (/** @type {string} */ path, /** @type {boolean} */ value) => {
    switch (path) {
        case 'data.world':
            worldLayer.enabled = value;
            break;
        case 'data.xray':
            xrayLayer.enabled = value;
            break;
        case 'data.character':
            characterLayer.enabled = value;
            break;
        case 'data.front':
            frontLayer.enabled = value;
            break;
        case 'data.frontClearDepth':
            frontLayer.clearDepthBuffer = value;
            break;
    }
});

data.set('data', {
    world: true,
    xray: true,
    character: true,
    front: true,
    frontClearDepth: true
});

// ------ Update loop ------

const walkCenter = new Vec3(-60, 1, -35);
const walkRadiusX = 90;
const walkRadiusZ = 50;
const position = new Vec3();
const target = new Vec3();
let angle = 0;

app.on('update', (dt) => {
    // walk in an ellipse on the open floor - the walk animation roughly matches this speed
    angle += dt * 0.6;

    position.set(
        walkCenter.x + Math.sin(angle) * walkRadiusX,
        walkCenter.y,
        walkCenter.z + Math.cos(angle) * walkRadiusZ
    );
    walkerRoot.setLocalPosition(position);

    // face the walking direction (tangent of the ellipse) - lookAt points the entity's -Z axis
    // at the target, and the model faces +Z, so look at the point behind the character
    target.set(
        walkCenter.x + Math.sin(angle - 0.1) * walkRadiusX,
        walkCenter.y,
        walkCenter.z + Math.cos(angle - 0.1) * walkRadiusZ
    );
    walkerRoot.lookAt(target);

    // slowly spin the held cube
    cubeEntity.rotateLocal(0, 20 * dt, 0);
});
