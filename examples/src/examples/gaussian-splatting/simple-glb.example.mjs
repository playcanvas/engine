// @config
//
// Basic example showing a Gaussian Splat loaded from a glb file using the KHR_gaussian_splatting
// extension, with orbit camera controls.

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
    GSplatComponentSystem,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCSS_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

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

const assets = {
    biker: new Asset('gsplat-glb', 'container', { url: './assets/splats/biker.glb' }),
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Instantiate the container - this creates an entity hierarchy with a gsplat component
// note: unlike ply files, the glb file stores the splat data in the glTF coordinate system
// (y-up), so no flip rotation is needed here
const biker = assets.biker.resource.instantiateRenderEntity();
biker.setLocalPosition(-1.5, 0.05, 0);
biker.setLocalEulerAngles(0, -90, 0);
biker.setLocalScale(0.7, 0.7, 0.7);
app.root.addChild(biker);

// Enable shadow casting on the instantiated gsplat component
const gsplatComponent = biker.findComponent('gsplat');
if (gsplatComponent) {
    gsplatComponent.castShadows = true;
}

const ORBIT_PIVOT = new Vec3().copy(biker.getPosition());
ORBIT_PIVOT.y += 1;
const ORBIT_DISTANCE = 4;
const ORBIT_INITIAL_YAW = 32;
const ORBIT_INITIAL_PITCH = -10;

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2),
    toneMapping: TONEMAP_ACES
});
app.root.addChild(camera);

camera.addComponent('script');
const orbitCam = /** @type {any} */ (
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 60,
            frameOnStart: false
        }
    })
);
if (orbitCam) {
    orbitCam.pivotPoint.copy(ORBIT_PIVOT);
    orbitCam.reset(ORBIT_INITIAL_YAW, ORBIT_INITIAL_PITCH, ORBIT_DISTANCE);
    orbitCam._updatePosition();
}
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');

// Create ground to receive shadows
const material = new StandardMaterial();
material.diffuse = new Color(0.5, 0.5, 0.4);
material.gloss = 0.2;
material.metalness = 0.5;
material.useMetalness = true;
material.update();

const ground = new Entity();
ground.addComponent('render', {
    type: 'box',
    material: material,
    castShadows: false
});
ground.setLocalScale(10, 1, 10);
ground.setLocalPosition(0, -0.45, 0);
app.root.addChild(ground);

// Shadow casting directional light
// Note: it does not affect gsplat, as lighting is not supported there currently
const directionalLight = new Entity();
directionalLight.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    castShadows: true,
    intensity: 1,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowDistance: 10,
    shadowIntensity: 0.5,
    shadowResolution: 2048,
    shadowType: SHADOW_PCSS_32F,
    penumbraSize: 0.05,
    penumbraFalloff: 4,
    shadowSamples: 16,
    shadowBlockerSamples: 16
});
directionalLight.setEulerAngles(55, 0, 20);
app.root.addChild(directionalLight);
