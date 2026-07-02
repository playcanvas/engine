// @config
// @flag HIDDEN
// @flag WEBGPU_DISABLED
//
// @credit
// title: Black Honey Robotic Arm
// author: Sketchfab
// source: https://sketchfab.com/3d-models/black-honey-robotic-arm-c50671f2a8e74de2a2e687103fdc93ab
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    JsonHandler,
    Keyboard,
    LIGHTFALLOFF_INVERSESQUARED,
    LIGHTSHAPE_RECT,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCSS_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType, win } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

await new Promise((resolve) => {
    WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const assets = {
    orbitCamera: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    cube: new Asset('cube', 'container', { url: './assets/models/playcanvas-cube.glb' }),
    luts: new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' }),
    asset: new Asset('asset', 'container', { url: './assets/models/robot-arm.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new Keyboard(document.body);
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    AnimComponentSystem
];
createOptions.resourceHandlers = [
    TextureHandler,
    ContainerHandler,
    ScriptHandler,
    JsonHandler,
    AnimClipHandler,
    AnimStateGraphHandler
];

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

app.scene.skyboxMip = 1;
app.scene.ambientLight.set(0, 0, 0);
app.scene.ambientLuminance = 0;
app.scene.setSkybox(assets.helipad.resources);

// enable area lights which are disabled by default for clustered lighting
app.scene.clusteredLightingEnabled = false;
app.scene.skyboxIntensity = 0.1;

// set the loaded area light LUT data
const luts = assets.luts.resource;
app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

const planeMaterial = new StandardMaterial();
planeMaterial.gloss = 0.0;
planeMaterial.metalness = 0.7;
planeMaterial.useMetalness = true;
planeMaterial.update();

const plane = new Entity();
plane.addComponent('render', {
    type: 'plane',
    material: planeMaterial
});
plane.setLocalScale(new Vec3(100, 0, 100));
plane.setLocalPosition(0, 0, 0);
app.root.addChild(plane);

data.set('script', {
    cycle: true,
    animate: true,
    area: {
        enabled: true,
        intensity: 16.0,
        size: 2,
        shadowType: SHADOW_PCSS_32F
    },
    point: {
        enabled: true,
        intensity: 4.0,
        size: 2,
        shadowType: SHADOW_PCSS_32F
    },
    directional: {
        enabled: true,
        intensity: 2.0,
        size: 1,
        shadowType: SHADOW_PCSS_32F
    }
});

const occluder = assets.asset.resource.instantiateRenderEntity();
occluder.addComponent('anim', {
    activate: true
});
occluder.setLocalScale(3, 3, 3);
app.root.addChild(occluder);

occluder.anim.assignAnimation('Idle', assets.asset.resource.animations[0].resource);
occluder.anim.baseLayer.weight = 1.0;
occluder.anim.speed = 0.1;
// const animLayer = occluder.anim.addLayer('Idle', 1.0, )

app.scene.envAtlas = assets.helipad.resource;

const areaLight = new Entity();
areaLight.addComponent('light', {
    type: 'spot',
    shape: LIGHTSHAPE_RECT,
    color: new Color(0.25, 1, 0.25),
    castShadows: true,
    range: 150,
    shadowResolution: 2048,
    shadowDistance: 100,
    penumbraSize: data.get('script.area.size'),
    shadowType: data.get('script.area.shadowType'),
    intensity: data.get('script.area.intensity'),
    falloffMode: LIGHTFALLOFF_INVERSESQUARED,
    innerConeAngle: 45,
    outerConeAngle: 50,
    normalOffsetBias: 0.1
});
areaLight.setLocalScale(3, 1, 3);
areaLight.setEulerAngles(45, 90, 0);
areaLight.setLocalPosition(4, 7, 0);

// emissive material that is the light source color
const brightMaterial = new StandardMaterial();
brightMaterial.emissive = areaLight.light.color;
brightMaterial.emissiveIntensity = areaLight.light.intensity;
brightMaterial.useLighting = false;
brightMaterial.cull = CULLFACE_NONE;
brightMaterial.update();

const brightShape = new Entity();
// primitive shape that matches light source shape
brightShape.addComponent('render', {
    type: 'plane',
    material: brightMaterial,
    castShadows: false
});
areaLight.addChild(brightShape);
app.root.addChild(areaLight);

const directionalLight = new Entity();
directionalLight.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    castShadows: true,
    numCascades: 1,
    penumbraSize: data.get('script.directional.size'),
    shadowType: data.get('script.directional.shadowType'),
    intensity: data.get('script.directional.intensity'),
    shadowBias: 0.5,
    shadowDistance: 50,
    normalOffsetBias: 0.1,
    shadowResolution: 8192
});
directionalLight.setEulerAngles(65, 35, 0);
app.root.addChild(directionalLight);

const lightOmni = new Entity('Omni');
lightOmni.addComponent('light', {
    type: 'omni',
    color: new Color(1, 0.25, 0.25),
    range: 25,
    penumbraSize: data.get('script.point.size'),
    shadowType: data.get('script.point.shadowType'),
    intensity: data.get('script.point.intensity'),
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.2,
    shadowResolution: 2048
});
lightOmni.setLocalPosition(-4, 7, 0);

const omniMaterial = new StandardMaterial();
omniMaterial.emissive = lightOmni.light.color;
omniMaterial.emissiveIntensity = lightOmni.light.intensity;
omniMaterial.useLighting = false;
omniMaterial.cull = CULLFACE_NONE;
omniMaterial.update();

const omniShape = new Entity();
omniShape.addComponent('render', {
    type: 'sphere',
    material: omniMaterial,
    castShadows: false
});
omniShape.setLocalScale(0.2, 0.2, 0.2);
lightOmni.addChild(omniShape);
app.root.addChild(lightOmni);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    toneMapping: TONEMAP_ACES
});
camera.setLocalPosition(0, 5, 11);

camera.camera.requestSceneColorMap(true);
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: occluder,
        distanceMax: 500,
        frameOnStart: false
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

data.on('*:set', (/** @type {string} */ path, value) => {
    switch (path) {
        case 'script.area.enabled':
            areaLight.enabled = value;
            break;
        case 'script.area.intensity':
            areaLight.light.intensity = value;
            brightMaterial.emissiveIntensity = value;
            brightMaterial.update();
            break;
        case 'script.area.size':
            areaLight.light.penumbraSize = value;
            break;
        case 'script.area.shadowType':
            areaLight.light.shadowType = parseInt(value, 10);
            break;
        case 'script.directional.enabled':
            directionalLight.enabled = value;
            break;
        case 'script.directional.intensity':
            directionalLight.light.intensity = value;
            break;
        case 'script.directional.size':
            directionalLight.light.penumbraSize = value;
            break;
        case 'script.directional.shadowType':
            directionalLight.light.shadowType = parseInt(value, 10);
            break;
        case 'script.point.enabled':
            lightOmni.enabled = value;
            break;
        case 'script.point.intensity':
            lightOmni.light.intensity = value;
            break;
        case 'script.point.size':
            lightOmni.light.penumbraSize = value;
            break;
        case 'script.point.shadowType':
            lightOmni.light.shadowType = parseInt(value, 10);
            break;
    }
});

const areaLightElement = win.document.getElementById('area-light');
const pointLightElement = win.document.getElementById('point-light');
const directionalLightElement = win.document.getElementById('directional-light');

let resizeControlPanel = true;
let time = 0;
let timeDiff = 0;
let index = 0;
app.on('update', (dt) => {
    if (time === 0) {
        // @ts-ignore engine-tsd
        camera.script.orbitCamera.distance = 25;
    }
    timeDiff += dt;

    if (data.get('script.cycle')) {
        if (timeDiff / 5 > 1) {
            index = (index + 1) % 3;
            timeDiff = 0;
        }
        areaLight.enabled = index === 0;
        directionalLight.enabled = index === 1;
        lightOmni.enabled = index === 2;

        if (areaLightElement) {
            areaLightElement.ui.enabled = false;
            pointLightElement.ui.enabled = false;
            directionalLightElement.ui.enabled = false;
        }
    } else {
        if (areaLightElement) {
            areaLightElement.ui.enabled = true;
            pointLightElement.ui.enabled = true;
            directionalLightElement.ui.enabled = true;
        }

        areaLight.enabled = data.get('script.area.enabled');
        directionalLight.enabled = data.get('script.directional.enabled');
        lightOmni.enabled = data.get('script.point.enabled');
    }

    if (data.get('script.animate')) {
        time += dt;
        const x = Math.sin(time * 0.2);
        const z = Math.cos(time * 0.2);
        lightOmni.setLocalPosition(x * 4, 5, z * 4);
        directionalLight.setEulerAngles(65, 35 + time * 2, 0);
        areaLight.setEulerAngles(45, 180 + (time * 0.2 * 180.0) / Math.PI, 0);
        areaLight.setLocalPosition(-x * 4, 7, -z * 4);
    }

    // resize control panel to fit the content better
    if (resizeControlPanel) {
        const panel = win.document.getElementById('controlPanel');
        if (panel) {
            panel.style.width = '360px';
            resizeControlPanel = false;
        }
    }
});
