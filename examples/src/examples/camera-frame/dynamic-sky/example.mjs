// @config
//
// A dynamic sky - an analytic atmosphere over a day and night cycle, with stars, the moon and
// volumetric clouds drifting with the wind - rendered by the DynamicSkyEffect of the camera
// frame, which also lights the scene and keeps the sun light in sync with the sky.
//
// @credit
// title: Tropical Island
// author: Elin
// source: https://sketchfab.com/3d-models/tropical-island-f91862f8c38b481aa19edccac851eefb
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Caustic Lighting
// author: Davis3D
// source: https://opengameart.org/content/caustic-lighting
// license: CC0 (https://creativecommons.org/publicdomain/zero/1.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    AutoExposureEffect,
    CLOUDTYPE_VOLUMETRIC,
    CURVE_SMOOTHSTEP,
    CameraComponentSystem,
    CameraFrame,
    CircleGeometry,
    Color,
    ContainerHandler,
    Curve,
    DynamicSkyEffect,
    Entity,
    FILLMODE_FILL_WINDOW,
    FOG_EXP,
    LAYERID_DEPTH,
    Layer,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { Water } from 'playcanvas/scripts/esm/water.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the island glb is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    island: new Asset('island', 'container', { url: './assets/models/tropical-island.glb' }),
    normal: new Asset('normal', 'texture', { url: './assets/textures/normal-map.png' }),
    caustics: new Asset('caustics', 'texture', { url: './assets/textures/caustics.jpg' })
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

// get existing layers
const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const uiLayer = app.scene.layers.getLayerByName('UI');

// a layer for the water plane, so it can be excluded from the reflection and refraction rendering
const waterLayer = new Layer({ name: 'Water' });
app.scene.layers.insert(waterLayer, app.scene.layers.getTransparentIndex(worldLayer) + 1);

// the tropical island, and a second copy close by, rotated and sunk a bit deeper
const islandEntity = assets.island.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(islandEntity);

const islandEntity2 = new Entity('Island2');
islandEntity2.addChild(
    assets.island.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    })
);
islandEntity2.setLocalPosition(15.5, -0.59, -10.9);
islandEntity2.setLocalEulerAngles(0, 140, 0);
app.root.addChild(islandEntity2);

// enable the water's underwater fog and caustics on the island
const islandMaterials = new Set();
islandEntity.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((mi) => islandMaterials.add(mi.material));
});
islandMaterials.forEach((material) => {
    material.setDefine('WATER_HEIGHT_FOG', true);
    material.setDefine('WATER_CAUSTICS', true);
    material.update();
});

// underwater fog - the water script's fog chunk limits it to the fragments below the water level
app.scene.fog.type = FOG_EXP;
app.scene.fog.density = 0.068;

// the sun - the dynamic sky sets its direction, color and intensity by the time of day
const sun = new Entity('Sun');
// four shadow cascades, keeping the shadows sharp from close to the camera to the distance - the
// scene has little geometry to render to them. The cascades share the shadow map, each taking a
// quarter of it, so it is 2048 for 1024 texels per cascade
sun.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowDistance: 120,
    numCascades: 4,
    shadowResolution: 2048
});
app.root.addChild(sun);

// the camera, rendering the water layer too
const camera = new Entity('MainCamera');
camera.addComponent('camera', {
    fov: 60,
    farClip: 3000,
    layers: [worldLayer.id, LAYERID_DEPTH, skyboxLayer.id, waterLayer.id, uiLayer.id]
});
camera.setLocalPosition(-24.51, 4.59, 0.98);
app.root.addChild(camera);

camera.addComponent('script');
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(4.6, 2.11, -5.85);
cameraControls.pitchRange = new Vec2(-89, 89);
cameraControls.zoomRange = new Vec2(2, 150);

// HDR rendering with bloom - the threshold keeps the bloom to the sun and the brightest parts of
// the sky, without blurring the rest of the scene
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.rendering.sceneDepthMap = true;
cameraFrame.bloom.threshold = 5;
cameraFrame.bloom.blurLevel = 8;
const bloomIntensity = 0.02;

// the dynamic sky, lighting the scene and driving the sun
const sky = new DynamicSkyEffect(device);
sky.light = sun.light;
sky.moonIntensity = 0.4;
sky.cloudType = CLOUDTYPE_VOLUMETRIC;
sky.cloudSize = 9000;
sky.cloudHeight = 1800;

// the time of day animates, so the lighting blends between its updates instead of stepping, which
// would flicker in the reflection of the sky on the water
sky.lightingInterpolation = true;
cameraFrame.addEffect(sky);

// the auto exposure, adapting the exposure from the day to the night
const autoExposure = new AutoExposureEffect(device);
cameraFrame.addEffect(autoExposure);
cameraFrame.update();

// the water surface - a tessellated circle mesh, so the geometry waves can displace it
const waterMesh = Mesh.fromGeometry(
    device,
    new CircleGeometry({
        radius: 1200,
        sectors: 180,
        rings: 150,
        ringExponent: 2.6
    })
);
const water = new Entity('Water');
water.addComponent('render', {
    meshInstances: [new MeshInstance(waterMesh, new StandardMaterial())],
    layers: [waterLayer.id],
    castShadows: false
});
water.setLocalPosition(0, -0.62, 0);
app.root.addChild(water);

water.addComponent('script');
water.script.create(Water, {
    properties: {
        cameraEntity: camera,
        lightEntity: sun,
        normalMap: assets.normal.resource,
        causticsMap: assets.caustics.resource,
        waves: true,
        shallowColor: new Color(0.6, 0.9, 0.85),
        deepColor: new Color(0.03, 0.16, 0.24),
        depthFade: 3
    }
});

// the elevation of the sun over the day - x = hour, y = elevation in degrees
const elevationCurve = new Curve([0, -60, 6, 0, 12, 60, 18, 0, 24, -90]);
elevationCurve.type = CURVE_SMOOTHSTEP;

// the underwater fog color follows the daylight
const fogColor = new Color(0.165, 0.549, 0.596);
const dayFogColor = new Color();

data.set('data', {
    time: {
        hour: 5.5,
        animate: true,
        speed: 0.25
    },
    sky: {
        sunIntensity: sky.sunIntensity,
        luminance: sky.luminance,
        turbidity: sky.turbidity,
        rayleigh: sky.rayleigh,
        rotation: sky.rotation
    },
    clouds: {
        type: CLOUDTYPE_VOLUMETRIC,
        coverage: 0.42,
        softness: sky.cloudSoftness,
        brightness: sky.cloudBrightness,
        quality: 0.5,
        resolution: 1,
        windSpeed: 30,
        windDirection: 45,
        relight: 0.005
    },
    autoExposure: {
        enabled: true,
        compensation: 0.5
    },
    effects: {
        bloom: true,
        taa: false
    }
});

app.on('update', (/** @type {number} */ dt) => {
    // the time of day, looping from 20:00 back to 05:00 when animated, skipping most of the night
    let hour = data.get('data.time.hour');
    if (data.get('data.time.animate')) {
        hour += dt * data.get('data.time.speed');
        if (hour >= 20) hour -= 15;
        data.set('data.time.hour', hour);
    }

    // the sun, rising in the east and setting in the west
    const elevation = elevationCurve.value(hour);
    sky.elevation = elevation;
    sky.azimuth = (hour / 24) * 360;
    sky.sunIntensity = data.get('data.sky.sunIntensity');
    sky.luminance = data.get('data.sky.luminance');
    sky.turbidity = data.get('data.sky.turbidity');
    sky.rayleigh = data.get('data.sky.rayleigh');
    sky.rotation = data.get('data.sky.rotation');

    sky.cloudType = data.get('data.clouds.type');
    sky.cloudCoverage = data.get('data.clouds.coverage');
    sky.cloudSoftness = data.get('data.clouds.softness');
    sky.cloudBrightness = data.get('data.clouds.brightness');
    sky.cloudQuality = data.get('data.clouds.quality');
    sky.cloudResolution = data.get('data.clouds.resolution');
    sky.windSpeed = data.get('data.clouds.windSpeed');
    sky.windDirection = data.get('data.clouds.windDirection');

    // the clouds reflected by the water and lighting the scene follow the drifting clouds
    sky.lightingCloudThreshold = data.get('data.clouds.relight');

    cameraFrame.bloom.intensity = data.get('data.effects.bloom') ? bloomIntensity : 0;
    cameraFrame.taa.enabled = data.get('data.effects.taa');
    autoExposure.enabled = data.get('data.autoExposure.enabled');
    autoExposure.compensation = data.get('data.autoExposure.compensation');

    // the settings of the effects apply on the update of the camera frame
    cameraFrame.update();

    // the underwater fog dims with the daylight, with a small floor for the moonlit night
    const t = Math.max(0, Math.min(1, (elevation + 2) / 14));
    const day = 0.05 + 0.95 * t * t * (3 - 2 * t);
    dayFogColor.set(fogColor.r * day, fogColor.g * day, fogColor.b * day);
    app.scene.fog.color = dayFogColor;
});
