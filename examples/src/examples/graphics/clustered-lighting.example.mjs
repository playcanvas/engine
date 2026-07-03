// @config
// @flag ENGINE=performance

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    CylinderGeometry,
    DISPLAYFORMAT_HDR,
    Entity,
    FILLMODE_FILL_WINDOW,
    GAMMA_SRGB,
    LIGHTFALLOFF_INVERSESQUARED,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TONEMAP_ACES,
    TONEMAP_NONE,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' })
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // enable HDR rendering if supported
    displayFormat: DISPLAYFORMAT_HDR
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

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

/** @type {Array<Entity>} */
const pointLightList = [];
/** @type {Array<Entity>} */
const spotLightList = [];
/** @type {Entity|null} */
let dirLight = null;

// enabled clustered lighting. This is a temporary API and will change in the future
app.scene.clusteredLightingEnabled = true;

// adjust default clustered lighting parameters to handle many lights
const lighting = app.scene.lighting;

// 1) subdivide space with lights into this many cells
lighting.cells = new Vec3(12, 16, 12);

// 2) and allow this many lights per cell
lighting.maxLightsPerCell = 48;

lighting.shadowsEnabled = false;

// material with tiled normal map
let material = new StandardMaterial();
material.normalMap = assets.normal.resource;
material.normalMapTiling.set(5, 5);
material.bumpiness = 1;

// enable specular
material.gloss = 0.5;
material.metalness = 0.3;
material.useMetalness = true;

material.update();

// ground plane
const ground = new Entity();
ground.addComponent('render', {
    type: 'plane',
    material: material
});
ground.setLocalScale(150, 150, 150);
app.root.addChild(ground);

// high polycount cylinder
const cylinderMesh = Mesh.fromGeometry(app.graphicsDevice, new CylinderGeometry({ capSegments: 200 }));
const cylinder = new Entity();
cylinder.addComponent('render', {
    meshInstances: [new MeshInstance(cylinderMesh, material)],
    castShadows: true
});
app.root.addChild(cylinder);
cylinder.setLocalPosition(0, 50, 0);
cylinder.setLocalScale(50, 100, 50);

// create many omni lights that do not cast shadows
let count = 30;
for (let i = 0; i < count; i++) {
    const color = new Color(Math.random(), Math.random(), Math.random(), 1);
    const lightPoint = new Entity();
    lightPoint.addComponent('light', {
        type: 'omni',
        color: color,
        intensity: 2,
        range: 12,
        castShadows: false,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED
    });

    // attach a render component with a small sphere to each light
    const material = new StandardMaterial();
    material.emissive = color;
    material.emissiveIntensity = 10; // bright emissive to make it really bright on HDR displays
    material.update();

    lightPoint.addComponent('render', {
        type: 'sphere',
        material: material,
        castShadows: true
    });
    lightPoint.setLocalScale(5, 5, 5);

    // add it to the scene and also keep it in an array
    app.root.addChild(lightPoint);
    pointLightList.push(lightPoint);
}

// create many spot lights
count = 16;
for (let i = 0; i < count; i++) {
    const color = new Color(Math.random(), Math.random(), Math.random(), 1);
    const lightSpot = new Entity();
    lightSpot.addComponent('light', {
        type: 'spot',
        color: color,
        intensity: 2,
        innerConeAngle: 5,
        outerConeAngle: 6 + Math.random() * 40,
        range: 25,
        castShadows: false
    });

    // attach a render component with a small cone to each light
    material = new StandardMaterial();
    material.emissive = color;
    material.emissiveIntensity = 10; // bright emissive to make it really bright on HDR displays
    material.update();

    lightSpot.addComponent('render', {
        type: 'cone',
        material: material
    });
    lightSpot.setLocalScale(5, 5, 5);

    lightSpot.setLocalPosition(100, 50, 70);
    lightSpot.lookAt(new Vec3(100, 60, 70));
    app.root.addChild(lightSpot);
    spotLightList.push(lightSpot);
}

// Create a single directional light which casts shadows
dirLight = new Entity();
dirLight.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    intensity: 0.15,
    range: 300,
    shadowDistance: 600,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
app.root.addChild(dirLight);

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.05, 0.05, 0.05),
    farClip: 500,
    nearClip: 0.1,

    // if the device renders in HDR mode, disable tone mapping to output HDR values without any processing
    toneMapping: device.isHdr ? TONEMAP_NONE : TONEMAP_ACES,
    gammaCorrection: GAMMA_SRGB
});
camera.setLocalPosition(140, 140, 140);
camera.lookAt(new Vec3(0, 40, 0));

// add orbit camera script with mouse and touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: app.root,
        distanceMax: 400,
        frameOnStart: false
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Set an update function on the app's update event
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // move lights along sin based waves around the cylinder
    pointLightList.forEach((light, i) => {
        const angle = (i / pointLightList.length) * Math.PI * 2;
        const y = Math.sin(time * 0.5 + 7 * angle) * 30 + 70;
        light.setLocalPosition(30 * Math.sin(angle), y, 30 * Math.cos(angle));
    });

    // rotate spot lights around
    spotLightList.forEach((spotlight, i) => {
        const angle = (i / spotLightList.length) * Math.PI * 2;
        spotlight.setLocalPosition(40 * Math.sin(time + angle), 5, 40 * Math.cos(time + angle));
        spotlight.lookAt(Vec3.ZERO);
        spotlight.rotateLocal(90, 0, 0);
    });

    // rotate directional light
    if (dirLight) {
        dirLight.setLocalEulerAngles(25, -30 * time, 0);
    }
});
