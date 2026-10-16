// @config
//
// A turbofan on a display stand, cut away with clipping planes. Two planes through the engine axis
// remove a wedge from every part, and a third limits how far back the cut runs. The back faces of
// the parts, drawn in red, cap the cut.
//
// `LMB` Orbit · `Wheel` / `Pinch` Zoom

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CULLFACE_FRONT,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_LINEAR,
    Keyboard,
    LAYERID_DEPTH,
    LAYERID_IMMEDIATE,
    LAYERID_UI,
    LAYERID_WORLD,
    LightComponentSystem,
    MeshInstance,
    Mouse,
    Plane,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SSAOTYPE_COMBINE,
    ScriptComponentSystem,
    ScriptHandler,
    SmaaEffect,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WasmModule,
    basisInitialize,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the turbofan's geometry is Draco compressed, and its textures are Basis compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});
basisInitialize({
    glueUrl: './assets/wasm/basis/basis.wasm.js',
    wasmUrl: './assets/wasm/basis/basis.wasm.wasm',
    fallbackUrl: './assets/wasm/basis/basis.js'
});

const assets = {
    turbofan: new Asset('turbofan', 'container', { url: './assets/models/turbofan.glb' }),
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/product-studio-env-atlas.png' },
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

// a studio: the environment lights the scene, and the floor fades into a dark backdrop. Fog takes
// an sRGB color, while the camera clears its linear HDR target with the color as given
const backdrop = new Color(0.2, 0.21, 0.24);
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.fog.type = FOG_LINEAR;
app.scene.fog.color = backdrop;
app.scene.fog.start = 9;
app.scene.fog.end = 24;

const floorMaterial = new StandardMaterial();
floorMaterial.diffuse = new Color(0.06, 0.065, 0.075);
floorMaterial.gloss = 0.45;
floorMaterial.update();
const floor = new Entity('floor');
floor.addComponent('render', { type: 'plane', material: floorMaterial, castShadows: false });
floor.setLocalScale(60, 1, 60);
app.root.addChild(floor);

const turbofan = assets.turbofan.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(turbofan);
const engine = turbofan.findByName('Engine');
const lowSpool = turbofan.findByName('LowSpool');
const highSpool = turbofan.findByName('HighSpool');

const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    intensity: 1.6,
    castShadows: true,
    shadowDistance: 16,
    shadowResolution: 2048,
    shadowBias: 0.2,
    normalOffsetBias: 0.04
});
// the key light shines down into the cut from the front left
light.setEulerAngles(45, -50, 0);
app.root.addChild(light);

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: backdrop.clone().linear(),
    farClip: 100,
    layers: [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_IMMEDIATE, LAYERID_UI]
});
camera.addComponent('script');
camera.setPosition(-4.0, 3.9, 4.9);
app.root.addChild(camera);

// keep the engine in view across the narrow side of the screen, such as on a portrait phone
const fitView = () => {
    const portrait = device.width < device.height;
    camera.camera.horizontalFov = portrait;
    camera.camera.fov = portrait ? 58 : 40;
};
device.on('resizecanvas', fitView);
fitView();

const controls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(controls, {
    focusPoint: new Vec3(0.2, 1.35, 0),
    sceneSize: 6,
    pitchRange: new Vec2(-85, 5),
    zoomRange: new Vec2(3, 16),
    enableFly: false
});

// post effects
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.rendering.sceneColorMap = true; // the acrylic stand refracts the scene behind it
cameraFrame.bloom.blurLevel = 7;
cameraFrame.ssao.type = SSAOTYPE_COMBINE;
cameraFrame.ssao.radius = 0.4;
cameraFrame.ssao.samples = 12;
cameraFrame.ssao.scale = 0.5;
cameraFrame.vignette.inner = 0.4;
cameraFrame.vignette.outer = 1.2;

// SMAA is an optional effect, added to the camera frame to be enabled when selected
const smaa = new SmaaEffect(device);
cameraFrame.addEffect(smaa);

const applyEffects = () => {
    const aa = data.get('data.effects.aa');
    cameraFrame.rendering.samples = aa === 'msaa' ? 4 : 1;
    smaa.enabled = aa === 'smaa';
    cameraFrame.taa.enabled = aa === 'taa';
    cameraFrame.rendering.sharpness = aa === 'taa' ? 0.5 : 0;
    cameraFrame.bloom.intensity = data.get('data.effects.bloom') ? 0.02 : 0;
    cameraFrame.ssao.intensity = data.get('data.effects.ssao') ? 0.5 : 0;
    cameraFrame.vignette.intensity = data.get('data.effects.vignette') ? 0.45 : 0;
    cameraFrame.update();
};

// section caps: the back faces of the cut parts, drawn flat red, show through the cut where the
// parts are solid. This needs closed meshes, and shows their inner surfaces, not the cut plane
const capMaterial = new StandardMaterial();
capMaterial.diffuse = new Color(0, 0, 0);
capMaterial.emissive = new Color(0.62, 0.05, 0.04);
capMaterial.useLighting = false;
capMaterial.cull = CULLFACE_FRONT;
capMaterial.update();

// a cap draws the mesh of a part, and its instances when it is instanced, on the part's node
const createCap = (meshInstance) => {
    const cap = new MeshInstance(meshInstance.mesh, capMaterial, meshInstance.node);
    if (meshInstance.instancingData) {
        cap.setInstancing(meshInstance.instancingData.vertexBuffer);
    }
    return cap;
};

const renders = engine.findComponents('render');
const caps = new Entity('section-caps');
caps.addComponent('render', {
    meshInstances: renders.flatMap((render) => render.meshInstances.map(createCap)),
    castShadows: false
});
app.root.addChild(caps);

// the cut: two planes through the engine axis remove a wedge, and in intersection mode only what
// is behind all planes is clipped, so a third plane across the axis limits how far back it runs
const planes = [new Plane(), new Plane(), new Plane()];
const inlet = -2.2; // the extent of the engine along its axis
const exhaust = 2.6;
const updateCut = () => {
    const axis = engine.getPosition();
    const rotation = data.get('data.cut.rotation') * math.DEG_TO_RAD;
    const end = rotation + data.get('data.cut.opening') * math.DEG_TO_RAD;
    planes[0].setFromPointNormal(axis, new Vec3(0, -Math.cos(rotation), Math.sin(rotation)));
    planes[1].setFromPointNormal(axis, new Vec3(0, Math.cos(end), -Math.sin(end)));
    const x = axis.x + math.lerp(inlet, exhaust, data.get('data.cut.length'));
    planes[2].setFromPointNormal(new Vec3(x, 0, 0), Vec3.RIGHT);

    const enabled = data.get('data.cut.enabled');
    caps.enabled = enabled && data.get('data.cut.caps');
    for (const render of [...renders, caps.render]) {
        render.clippingPlanes = enabled ? planes : [];
        render.clipIntersection = true;
    }
};

data.on('*:set', (/** @type {string} */ path) => {
    if (path.startsWith('data.cut')) updateCut();
    if (path.startsWith('data.effects')) applyEffects();
});
data.set('data', {
    cut: { enabled: true, opening: 90, rotation: 0, length: 0, caps: true },
    effects: { aa: 'msaa', bloom: true, ssao: true, vignette: true },
    spin: true
});

// on start, the cut runs from the inlet back to the exhaust
let reveal = 0;
app.on('update', (dt) => {
    if (reveal < 1) {
        reveal = Math.min(1, reveal + dt / 3);
        data.set('data.cut.length', math.smootherstep(0, 1, reveal));
    }

    // the spools turn slowly, the fan and its turbine slower than the core
    if (data.get('data.spin')) {
        lowSpool.rotateLocal(-40 * dt, 0, 0);
        highSpool.rotateLocal(-70 * dt, 0, 0);
    }
});
