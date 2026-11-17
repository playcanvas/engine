// @config
//
// Lights specified in physical units (lumens, lux), exposed through a camera with aperture, shutter and ISO.
//
// @credit
// title: Sheen Chair
// author: Wayfair LLC
// source: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/SheenChair
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CULLFACE_NONE,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_EXP2,
    Gizmo,
    JsonHandler,
    Keyboard,
    LIGHTFALLOFF_INVERSESQUARED,
    LIGHTSHAPE_RECT,
    LightComponentSystem,
    LightGizmo,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType, win } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    sheen: new Asset('sheen', 'container', { url: './assets/models/SheenChair.glb' }),
    luts: new Asset('luts', 'json', { url: './assets/json/area-light-luts.json' })
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
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, JsonHandler];

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

// Dark gallery look: the environment only provides soft ambient light, the skybox itself is hidden
const backgroundColor = new Color(0.02, 0.022, 0.03);
app.scene.skyboxMip = 1;
app.scene.layers.getLayerByName('Skybox').enabled = false;
app.scene.ambientLight.set(0.5, 0.55, 0.7);
app.scene.ambientLuminance = 4000;

// Fade the floor into the background
app.scene.fog.type = FOG_EXP2;
app.scene.fog.color.copy(backgroundColor);
app.scene.fog.density = 0.03;

// Enable area lights which are disabled by default for clustered lighting
app.scene.lighting.areaLightsEnabled = true;

// The only area light is a rectangle, so the shaders of the materials compile no disk and sphere
// light code, which makes them faster to compile
app.scene.lighting.areaLightDiskEnabled = false;
app.scene.lighting.areaLightSphereEnabled = false;

// Set the loaded area light LUT data
const luts = /** @type {{ LTC_MAT_1: number[], LTC_MAT_2: number[] }} */ (assets.luts.resource);
app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

// A row of chairs in alternating fabrics, the outer ones turned in a little
[
    { x: 0.3, z: -2.5, yaw: 15, variant: 'Peacock Velvet' },
    { x: 4, z: 0, yaw: 0, variant: 'Peacock Velvet' },
    { x: 7, z: 0, yaw: 0, variant: 'Mango Velvet' },
    { x: 10, z: -2.5, yaw: -15, variant: 'Mango Velvet' }
].forEach(({ x, z, yaw, variant }) => {
    const chair = assets.sheen.resource.instantiateRenderEntity({
        castShadows: true
    });
    chair.setLocalScale(3, 3, 3);
    chair.setLocalPosition(x, -1.0, z);
    chair.setLocalEulerAngles(0, yaw, 0);
    assets.sheen.resource.applyMaterialVariant(chair, variant);
    app.root.addChild(chair);
});

// Dark polished floor
const material = new StandardMaterial();
material.diffuse = new Color(0.15, 0.15, 0.17);
material.gloss = 0.65;
material.useMetalness = false;
material.specular = new Color(0.7, 0.7, 0.7);
material.update();

const plane = new Entity();
plane.addComponent('render', {
    type: 'plane',
    material: material
});
plane.setLocalScale(new Vec3(300, 0, 300));
plane.setLocalPosition(0, -1.0, 0);
app.root.addChild(plane);

data.set('script', {
    sun: {
        luminance: 100000
    },
    sky: {
        luminance: 6000
    },
    spot: {
        enabled: true,
        luminance: 600000,
        aperture: 30
    },
    point: {
        enabled: true,
        luminance: 1200000
    },
    rect: {
        enabled: true,
        luminance: 200000
    },
    camera: {
        aperture: 16.0,
        shutter: 1000,
        sensitivity: 1000,
        animate: false,
        toneMapping: TONEMAP_ACES
    },
    scene: {
        physicalUnits: true,
        sky: true
    }
});

app.scene.physicalUnits = data.get('script.scene.physicalUnits');
app.scene.envAtlas = assets.helipad.resource;

app.scene.skyboxLuminance = data.get('script.sky.luminance');

const directionalLight = new Entity();
directionalLight.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.94, 0.85),
    castShadows: true,
    luminance: data.get('script.sun.luminance'),
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
directionalLight.setEulerAngles(45, 35, 0);
app.root.addChild(directionalLight);

const omniLight = new Entity();
omniLight.addComponent('light', {
    type: 'omni',
    range: 7,
    falloffMode: LIGHTFALLOFF_INVERSESQUARED,
    color: new Color(1, 0.4, 0.75),
    castShadows: false,
    luminance: data.get('script.point.luminance'),
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
omniLight.setLocalPosition(-0.5, 1.2, -5);
app.root.addChild(omniLight);

const spotLight = new Entity();
spotLight.addComponent('light', {
    type: 'spot',
    range: 8,
    falloffMode: LIGHTFALLOFF_INVERSESQUARED,
    color: new Color(0.55, 0.75, 1),
    castShadows: false,
    luminance: data.get('script.spot.luminance'),
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowResolution: 2048,
    outerConeAngle: data.get('script.spot.aperture'),
    innerConeAngle: 0
});
spotLight.setLocalPosition(10, 1.5, -5);
// A spot light shines along its local -Y axis
spotLight.lookAt(new Vec3(9.5, 0, 0));
spotLight.rotateLocal(90, 0, 0);
app.root.addChild(spotLight);

const areaLight = new Entity();
areaLight.addComponent('light', {
    type: 'spot',
    shape: LIGHTSHAPE_RECT,
    color: new Color(1, 0.72, 0.38),
    range: 9999,
    luminance: data.get('script.rect.luminance'),
    falloffMode: LIGHTFALLOFF_INVERSESQUARED,
    innerConeAngle: 80,
    outerConeAngle: 85,
    normalOffsetBias: 0.1
});
areaLight.setLocalScale(4, 1, 5);
areaLight.setEulerAngles(70, 180, 0);
areaLight.setLocalPosition(5, 3, -5);

// Emissive material that is the light source color
const brightMaterial = new StandardMaterial();
brightMaterial.emissive = areaLight.light.color;
brightMaterial.emissiveIntensity = areaLight.light.luminance;
brightMaterial.useLighting = false;
brightMaterial.cull = CULLFACE_NONE;
brightMaterial.update();

const brightShape = new Entity();
// Primitive shape that matches light source shape
brightShape.addComponent('render', {
    type: 'plane',
    material: brightMaterial,
    castShadows: false
});
areaLight.addChild(brightShape);
app.root.addChild(areaLight);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: backgroundColor,
    fov: 40,
    aperture: data.get('script.camera.aperture'),
    shutter: 1 / data.get('script.camera.shutter'),
    sensitivity: data.get('script.camera.sensitivity')
});
camera.setLocalPosition(11, 4, 13);

camera.camera.requestSceneColorMap(true);
camera.addComponent('script');
camera.script.create(CameraControls, {
    properties: {
        enableFly: false,
        focusPoint: new Vec3(6.5, 1.5, -1),
        pitchRange: new Vec2(-90, 90),
        zoomRange: new Vec2(1, 400)
    }
});
app.root.addChild(camera);

// Tone mapping and vignette
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.vignette.intensity = 0.6;
cameraFrame.update();

// Draw the shape of each light, in the color of the light
const gizmoLayer = Gizmo.createLayer(app, 'Helpers', undefined, true);
const lightGizmo = new LightGizmo(camera.camera, gizmoLayer);
lightGizmo.handles = false;
lightGizmo.useLightColor = true;
lightGizmo.attach([omniLight, spotLight]);

data.on('*:set', (/** @type {string} */ path, value) => {
    if (path === 'script.sun.luminance') {
        directionalLight.light.luminance = value;
    } else if (path === 'script.sky.luminance') {
        app.scene.skyboxLuminance = value;
    } else if (path === 'script.spot.luminance') {
        spotLight.light.luminance = value;
    } else if (path === 'script.spot.aperture') {
        spotLight.light.outerConeAngle = value;
    } else if (path === 'script.point.luminance') {
        omniLight.light.luminance = value;
    } else if (path === 'script.spot.enabled') {
        spotLight.enabled = value;
    } else if (path === 'script.point.enabled') {
        omniLight.enabled = value;
    } else if (path === 'script.rect.enabled') {
        // also hides the emissive shape, which is a child of the light
        areaLight.enabled = value;
    } else if (path === 'script.rect.luminance') {
        areaLight.light.luminance = value;
        brightMaterial.emissiveIntensity = value;
        brightMaterial.update();
    } else if (path === 'script.camera.aperture') {
        camera.camera.aperture = value;
    } else if (path === 'script.camera.shutter') {
        camera.camera.shutter = 1 / value;
    } else if (path === 'script.camera.sensitivity') {
        camera.camera.sensitivity = value;
    } else if (path === 'script.scene.physicalUnits') {
        app.scene.physicalUnits = value;
    } else if (path === 'script.scene.sky') {
        if (value) {
            app.scene.envAtlas = assets.helipad.resource;
        } else {
            app.scene.setSkybox(null);
        }
    }
});

let resizeControlPanel = true;
let time = 0;
app.on('update', (dt) => {
    time += dt;

    // Resize control panel to fit the content better
    if (resizeControlPanel) {
        const panel = win.document.getElementById('controlPanel');
        if (panel) {
            panel.style.width = '360px';
            resizeControlPanel = false;
        }
    }

    if (data.get('script.camera.animate')) {
        data.set('script.camera.aperture', 3 + (1 + Math.sin(time)) * 5.0);
    }
});
