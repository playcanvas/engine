// @config
//
// @credit
// title: Laboratory
// author: Sketchfab
// source: https://sketchfab.com/3d-models/laboratory-e860e49837c044478db650868866a448
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Gizmo,
    Keyboard,
    LightComponentSystem,
    Mouse,
    Plane,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    TranslateGizmo,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the laboratory is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    laboratory: new Asset('laboratory', 'container', { url: './assets/models/laboratory.glb' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
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

app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 1.5;

const laboratory = assets.laboratory.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
laboratory.setLocalScale(100, 100, 100);
app.root.addChild(laboratory);

// the sun casts shadows through the cut, onto the floor of the rooms
const sun = new Entity('sun');
sun.addComponent('light', {
    type: 'directional',
    intensity: 1.5,
    castShadows: true,
    shadowDistance: 300,
    shadowResolution: 2048,
    shadowBias: 0.3,
    normalOffsetBias: 0.05
});
sun.setEulerAngles(50, 40, 0);
app.root.addChild(sun);

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.65, 0.7, 0.75),
    farClip: 2000
});
camera.addComponent('script');
camera.setPosition(-170, 200, 230);
app.root.addChild(camera);

// keep the laboratory in view across the narrow side of the screen, such as on a portrait phone
const fitView = () => {
    camera.camera.horizontalFov = device.width < device.height;
};
device.on('resizecanvas', fitView);
fitView();

const controls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(controls, {
    focusPoint: new Vec3(0, 10, 0),
    sceneSize: 200,
    pitchRange: new Vec2(-89, -10),
    zoomRange: new Vec2(80, 400),
    enableFly: false
});

// the section plane: everything above it is cut away, which opens the rooms from above. A
// translucent quad shows where the cut is, and a gizmo moves it up and down
const section = new Entity('section');
const sectionMaterial = new StandardMaterial();
sectionMaterial.diffuse = new Color(0, 0, 0);
sectionMaterial.emissive = new Color(0.3, 0.75, 1);
sectionMaterial.opacity = 0.08;
sectionMaterial.blendType = BLEND_NORMAL;
sectionMaterial.depthWrite = false;
sectionMaterial.update();
section.addComponent('render', { type: 'plane', material: sectionMaterial, castShadows: false });
section.setLocalScale(210, 1, 210);
section.setPosition(0, 18, 0);
app.root.addChild(section);

const renders = laboratory.findComponents('render');
const plane = new Plane();
const updateSection = () => {
    plane.setFromPointNormal(section.getPosition(), Vec3.DOWN);
    for (const render of renders) {
        render.clippingPlanes = [plane];
    }
};
updateSection();

const gizmo = new TranslateGizmo(camera.camera, Gizmo.createLayer(app));
for (const axis of ['x', 'z', 'xyz', 'yz', 'xz', 'xy']) {
    gizmo.enableShape(axis, false);
}
gizmo.attach(section);
gizmo.on('transform:move', updateSection);

// the camera does not orbit while the gizmo is dragged
gizmo.on('pointer:down', (_x, _y, meshInstance) => {
    controls.enabled = !meshInstance;
});
gizmo.on('pointer:up', () => {
    controls.enabled = true;
});
