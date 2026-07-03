// @config
// @flag HIDDEN

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
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'morning-env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new Asset('model', 'container', { url: './assets/models/TwoSidedPlane.glb' })
};

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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

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

app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.4;
app.scene.envAtlas = assets.helipad.resource;

const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.8, 0.25),
    intensity: 2
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const entity = assets.model.resource.instantiateRenderEntity();
app.root.addChild(entity);

const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.setPosition(0, 2, 6);
app.root.addChild(camera);

const cc = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cc.focusPoint = new Vec3(0, 0, 0);

const lightMaterial = new StandardMaterial();
lightMaterial.emissive = Color.WHITE;
lightMaterial.diffuse = Color.BLACK;
lightMaterial.useLighting = false;
lightMaterial.update();

const omniLight = new Entity();
omniLight.addComponent('light', {
    type: 'omni',
    color: new Color(1, 1, 1),
    intensity: 4,
    range: 10,
    castShadows: false
});
omniLight.addComponent('render', {
    type: 'sphere',
    material: lightMaterial,
    castShadows: false,
    receiveShadows: false
});
omniLight.setLocalScale(0.1, 0.1, 0.1);
app.root.addChild(omniLight);

const orbitRadius = 2;
let time = 0;
app.on('update', (dt) => {
    time += dt * 0.5;
    omniLight.setPosition(Math.cos(time) * orbitRadius, Math.sin(time) * orbitRadius, 0);
});
