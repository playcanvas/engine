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
    BLEND_NONE,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    DepthState,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA16F,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOWUPDATE_THISFRAME,
    SSAOTYPE_LIGHTING,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    laboratory: new Asset('statue', 'container', { url: './assets/models/laboratory.glb' }),
    orbit: new Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' }),
    ssao: new Asset('ssao', 'script', { url: './scripts/posteffects/posteffect-ssao.js' }),
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
createOptions.resourceHandlers = [ScriptHandler, TextureHandler, ContainerHandler, FontHandler];

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

// setup skydome
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 2.5;

// get the instance of the laboratory
const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
laboratoryEntity.setLocalScale(100, 100, 100);
app.root.addChild(laboratoryEntity);

// set up materials
laboratoryEntity.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((meshInstance) => {
        // disable blending / enable depth writes
        meshInstance.material.depthState = DepthState.DEFAULT;
        meshInstance.material.blendType = BLEND_NONE;

        // disable baked AO map as we want to use SSAO only
        meshInstance.material.aoMap = null;
        meshInstance.material.update();
    });
});

// add lights to the torches
const torches = laboratoryEntity.find(node => node.name.indexOf('Fackel') !== -1);
torches.forEach((torch) => {
    const light = new Entity('Omni');
    light.addComponent('light', {
        type: 'omni',
        color: new Color(1, 0.75, 0),
        intensity: 3,
        range: 100,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.2,
        shadowUpdateMode: SHADOWUPDATE_THISFRAME
    });
    light.setLocalPosition(torch.children[0].render.meshInstances[0].aabb.center);
    app.root.addChild(light);
});

// add a ground plane
const planeMaterial = new StandardMaterial();
planeMaterial.diffuse = new Color(0.2, 0.2, 0.2);
planeMaterial.update();

const primitive = new Entity();
primitive.addComponent('render', {
    type: 'plane',
    material: planeMaterial
});
primitive.setLocalScale(new Vec3(400, 1, 400));
primitive.setLocalPosition(0, -40, 0);
app.root.addChild(primitive);

// Create a directional light
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    intensity: 1,
    castShadows: true,
    shadowResolution: 4096,
    shadowBias: 0.4,
    normalOffsetBias: 0.06,
    shadowDistance: 600,
    shadowUpdateMode: SHADOWUPDATE_THISFRAME
});
app.root.addChild(light);
light.setLocalEulerAngles(35, 30, 0);

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    nearClip: 1,
    farClip: 600,
    toneMapping: TONEMAP_NEUTRAL
});

// add orbit camera script
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: laboratoryEntity,
        distanceMax: 350
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

// position the camera in the world
cameraEntity.setLocalPosition(-60, 30, 60);
app.root.addChild(cameraEntity);

// ------ Custom render passes set up ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;

// use 16but render target for better precision, improves quality with TAA and randomized SSAO
cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA16F];

const applySettings = () => {
    // enabled
    cameraFrame.enabled = data.get('data.enabled');

    cameraFrame.ssao.type = data.get('data.ssao.type');
    cameraFrame.ssao.blurEnabled = data.get('data.ssao.blurEnabled');
    cameraFrame.ssao.intensity = data.get('data.ssao.intensity');
    cameraFrame.ssao.power = data.get('data.ssao.power');
    cameraFrame.ssao.radius = data.get('data.ssao.radius');
    cameraFrame.ssao.samples = data.get('data.ssao.samples');
    cameraFrame.ssao.minAngle = data.get('data.ssao.minAngle');
    cameraFrame.ssao.scale = data.get('data.ssao.scale');
    cameraFrame.ssao.randomize = data.get('data.ssao.randomize');
    cameraFrame.debug = data.get('data.ssao.debug') ? 'ssao' : null;

    // TAA or MSAA
    const taa = data.get('data.ssao.taa');
    cameraFrame.taa.enabled = taa;
    cameraFrame.rendering.samples = taa ? 1 : 4; // disable MSAA when TAA is enabled
    cameraFrame.rendering.sharpness = taa ? 1 : 0; // sharpen the image when TAA is enabled

    cameraFrame.update();
};

// apply UI changes
data.on('*:set', (/** @type {string} */ path, value) => {
    applySettings();

    // if scale has changed, adjust min angle based on scale to avoid depth related artifacts
    const pathArray = path.split('.');
    if (pathArray[2] === 'scale') {
        if (value < 0.6) {
            data.set('data.ssao.minAngle', 40);
        } else if (value < 0.8) {
            data.set('data.ssao.minAngle', 20);
        } else {
            data.set('data.ssao.minAngle', 10);
        }
    }
});

// initial settings
data.set('data', {
    enabled: true,
    ssao: {
        type: SSAOTYPE_LIGHTING,
        blurEnabled: true,
        radius: 30,
        samples: 12,
        intensity: 0.4,
        power: 6,
        minAngle: 10,
        scale: 1,
        taa: false,
        randomize: false,
        debug: false
    }
});
