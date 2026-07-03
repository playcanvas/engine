// @config
//
// @credit
// title: Terrain Low Poly
// author: Sketchfab
// source: https://sketchfab.com/3d-models/terrain-low-poly-248b21331315466e98d20c441935d99d
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

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
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    SHADOW_PCSS_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    terrain: new Asset('terrain', 'container', { url: './assets/models/terrain.glb' }),
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

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('settings', {
    light: {
        soft: true,
        shadowResolution: 2048,
        penumbraSize: 0.03,
        penumbraFalloff: 4,
        shadowSamples: 16,
        shadowBlockerSamples: 16
    }
});

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Setup skydome
app.scene.skyboxMip = 3;
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, -70, 0);

// Instantiate the terrain
/** @type {Entity} */
const terrain = assets.terrain.resource.instantiateRenderEntity();
terrain.setLocalScale(30, 30, 30);
app.root.addChild(terrain);

// Get the clouds so that we can animate them
/** @type {Array<Entity>} */
const srcClouds = terrain.find(node => {
    const isCloud = node.name.includes('Icosphere');

    if (isCloud) {
        // No shadow receiving for clouds
        node.render.receiveShadows = false;
    }

    return isCloud;
});

// Clone some additional clouds
/** @type {Array<Entity>} */
const clouds = [];
srcClouds.forEach(cloud => {
    clouds.push(cloud);

    for (let i = 0; i < 3; i++) {
        /** @type {Entity} */
        const clone = cloud.clone();
        cloud.parent.addChild(clone);
        clouds.push(clone);
    }
});

// Shuffle the array to give clouds random order
clouds.sort(() => Math.random() - 0.5);

// A large orange pillar
const material = new StandardMaterial();
material.diffuse = new Color(1, 0.5, 0);
const pillar = new Entity('sphere');
pillar.addComponent('render', {
    type: 'box',
    material: material
});
pillar.setLocalScale(10, 130, 10);
pillar.setLocalPosition(180, 50, 110);
app.root.addChild(pillar);

// Find a tree in the middle to use as a focus point
const tree = terrain.findOne('name', 'Arbol 2.002');

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.9, 0.9, 0.9),
    farClip: 1000,
    toneMapping: TONEMAP_ACES
});

// And position it in the world
camera.setLocalPosition(-500, 160, 300);

// Add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: tree,
        distanceMax: 600
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Create a directional light casting soft shadows
const dirLight = new Entity('MainLight');
dirLight.addComponent('light', {
    ...{
        type: 'directional',
        color: Color.WHITE,
        shadowBias: 0.3,
        normalOffsetBias: 0.2,
        intensity: 1.0,

        // Enable shadow casting
        castShadows: true,
        shadowType: data.get('settings.light.soft') ? SHADOW_PCSS_32F : SHADOW_PCF3_32F,
        shadowDistance: 1000
    },
    ...data.get('settings.light')
});
app.root.addChild(dirLight);
dirLight.setLocalEulerAngles(75, 120, 20);

// Handle HUD changes - update properties on the light
data.on('*:set', (/** @type {string} */ path, value) => {
    const pathArray = path.split('.');
    if (pathArray[2] === 'soft') {
        dirLight.light.shadowType = value ? SHADOW_PCSS_32F : SHADOW_PCF3_32F;
    } else {
        dirLight.light[pathArray[2]] = value;
    }
});

const cloudSpeed = 0.2;
let frameNumber = 0;
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // On the first frame, when camera is updated, move it further away from the focus tree
    if (frameNumber === 0) {
        // @ts-ignore engine-tsd
        camera.script.orbitCamera.distance = 470;
    }

    // Move the clouds around
    clouds.forEach((cloud, index) => {
        const redialOffset = (index / clouds.length) * (6.24 / cloudSpeed);
        const radius = 9 + 4 * Math.sin(redialOffset);
        const cloudTime = time + redialOffset;
        cloud.setLocalPosition(
            2 + radius * Math.sin(cloudTime * cloudSpeed),
            4,
            -5 + radius * Math.cos(cloudTime * cloudSpeed)
        );
    });

    frameNumber++;
});
