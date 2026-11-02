// @config
//
// A day and night cycle over a desert. The DynamicSkyEffect of the camera frame renders the sky,
// lights the scene with it, keeps the sun in sync with the time of day, and hazes the distant dunes
// with the color of the sky behind them.
//
// @credit
// title: Laboratory
// author: Sketchfab
// source: https://sketchfab.com/3d-models/laboratory-e860e49837c044478db650868866a448
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: FREE - Dry Sand Terrain
// author: josevega
// source: https://sketchfab.com/3d-models/free-dry-sand-terrain-56c551e472b942de806afe90b1b9cdda
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NONE,
    BoundingBox,
    CURVE_SMOOTHSTEP,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Curve,
    DepthState,
    DynamicSkyEffect,
    Entity,
    FILLMODE_FILL_WINDOW,
    LIGHTFALLOFF_INVERSESQUARED,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA16F,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOWUPDATE_REALTIME,
    SHADOW_PCSS_32F,
    SSAOTYPE_LIGHTING,
    SSAOTYPE_NONE,
    ScriptComponentSystem,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { StandardMaterial } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    laboratory: new Asset('statue', 'container', { url: './assets/models/laboratory.glb' }),
    terrain: new Asset('terrain', 'container', { url: './assets/models/dry-sand-terrain.glb' })
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

// Get the instance of the laboratory
const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
laboratoryEntity.setLocalScale(100, 100, 100);
app.root.addChild(laboratoryEntity);

// Set up materials to use SSAO only (disable baked AO map)
laboratoryEntity.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((meshInstance) => {
        meshInstance.material.depthState = DepthState.DEFAULT;
        meshInstance.material.blendType = BLEND_NONE;
        /** @type {StandardMaterial} */ (meshInstance.material).aoMap = null;
        meshInstance.material.update();
    });
});

// Detect the torches in the model (all named 'Fackel*') and add a warm omni light at each.
// Their intensity is driven by the day/night cycle so they only glow between sunset and sunrise.
const torchIntensity = 60;
const torchLights = [];
laboratoryEntity
    .find((node) => node.name.indexOf('Fackel') !== -1)
    .forEach((torch) => {
        const render = /** @type {Entity} */ (torch).findComponent('render');
        if (!render) return;

        const light = new Entity('Torch');
        light.addComponent('light', {
            type: 'omni',
            color: new Color(1.0, 0.55, 0.2),
            intensity: 0,
            range: 480,
            // Keep the warm light contained to the torch's surroundings
            falloffMode: LIGHTFALLOFF_INVERSESQUARED
        });
        // Place at the flame's world-space position
        light.setPosition(render.meshInstances[0].aabb.center);
        app.root.addChild(light);
        torchLights.push(light);
    });

// Use the dry-sand terrain as the ground. Instantiate it, measure its native bounds, scale it
// Up to cover the scene out to the horizon, and drop it so its surface sits where the lab rests.
const terrain = assets.terrain.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(terrain);

// Accumulate the native (unscaled) world bounds of all the terrain mesh instances
const terrainMeshes = terrain.findComponents('render').flatMap((render) => render.meshInstances);
const terrainAabb = new BoundingBox();
terrainMeshes.forEach((mi, i) => (i === 0 ? terrainAabb.copy(mi.aabb) : terrainAabb.add(mi.aabb)));

// Scale so the terrain spans ~3000 units (out to the camera far clip), then center it on the lab
// And lower it so the top of the terrain sits near the old ground height, plus a hand-tuned
// Offset that beds the laboratory nicely into the dunes
const groundLevel = -40;
const terrainScale = 3000 / (2 * Math.max(terrainAabb.halfExtents.x, terrainAabb.halfExtents.z));
terrain.setLocalScale(terrainScale, terrainScale, terrainScale);

const tc = terrainAabb.center;
const terrainTop = (tc.y + terrainAabb.halfExtents.y) * terrainScale;
terrain.setLocalPosition(-tc.x * terrainScale - 71.6, groundLevel - terrainTop + 267.1, -tc.z * terrainScale + 395.8);

// Dim the terrain albedo (diffuse) by 0.5 to balance the bright sand against the darker building.
// Scaling diffuse multiplies the albedo texture, darkening the surface in direct and ambient light.
const dimmedTerrainMaterials = new Set();
terrain.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((mi) => {
        const material = /** @type {StandardMaterial} */ (mi.material);
        if (dimmedTerrainMaterials.has(material)) return;
        dimmedTerrainMaterials.add(material);
        material.diffuse.set(material.diffuse.r * 0.5, material.diffuse.g * 0.5, material.diffuse.b * 0.5);
        material.update();
    });
});

// A single directional light, kept in sync with the sun by the dynamic sky - its direction, color
// and intensity. It uses PCSS soft shadows so the shadow penumbra reacts to the (moving) sun.
const sunLight = new Entity('Sun');
sunLight.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowType: SHADOW_PCSS_32F,
    penumbraSize: 0.03,
    penumbraFalloff: 2.1,
    shadowSamples: 16,
    shadowBlockerSamples: 16,
    shadowResolution: 2048,
    // 4 cascades: each covers a smaller area at the same resolution, giving tighter shadow
    // Texels close to the camera (less acne)
    numCascades: 4,
    cascadeDistribution: 0.35,
    shadowBias: 0.18,
    normalOffsetBias: 0.82,
    shadowDistance: 2400,
    // The sun moves every frame, so the shadow map must be re-rendered in realtime
    // (SHADOWUPDATE_THISFRAME would render it once and then stop)
    shadowUpdateMode: SHADOWUPDATE_REALTIME
});
app.root.addChild(sunLight);

// Create an Entity with a camera component
const cameraEntity = new Entity('Camera');
cameraEntity.addComponent('camera', {
    farClip: 3000,
    fov: 80, // wide angle so more of the sky is visible
    toneMapping: TONEMAP_NEUTRAL
});
cameraEntity.setLocalPosition(240, 85, 240);
cameraEntity.addComponent('script');
app.root.addChild(cameraEntity);

// Add camera controls, framing the model with the sky behind it
const cc = /** @type {any} */ (cameraEntity.script.create(CameraControls));
cc.focusPoint = new Vec3(0, 25, 0);
// Limit how far the camera can orbit out, keeping it in the sharp near-cascade zone (x = min, y = max)
cc.zoomRange = new Vec2(1, 500);

// ------ Custom render passes set up ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;

// 16bit render target for HDR, so the bright sun blooms and SSAO has better precision
cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA16F];

// SSAO, applied to the ambient lighting (not as a post-process), toggled from the UI
cameraFrame.ssao.type = SSAOTYPE_LIGHTING;
cameraFrame.ssao.blurEnabled = true;
cameraFrame.ssao.intensity = 0.4;
cameraFrame.ssao.power = 6;
cameraFrame.ssao.radius = 30;
cameraFrame.ssao.samples = 12;
cameraFrame.ssao.minAngle = 10;

// HDR bloom, off by default (blurLevel left at its default of 16)
cameraFrame.bloom.intensity = 0;
cameraFrame.bloom.blurLevel = 16;

// The dynamic sky - renders the sky, lights the scene with it and drives the sun light. Its haze
// fades the distant dunes into the color of the sky behind them, densest at the ground level and
// thinning out above it
const sky = new DynamicSkyEffect(device);
sky.light = sunLight.light;
sky.sunIntensity = 6;
sky.haze = true;
sky.hazeBaseHeight = groundLevel;

// The densest haze the control gives, which it sets a fraction of
const HAZE_MAX_DENSITY = 0.0005;

// The time of day animates, so the lighting blends between its updates instead of stepping
sky.lightingInterpolation = true;
cameraFrame.addEffect(sky);
cameraFrame.update();

// Initial control values
data.set('data', {
    time: {
        hour: 9,
        animate: true
    },
    sky: {
        turbidity: 7,
        rayleigh: 1,
        exposure: 1.8,

        // turns the whole sky, and the sun with it, around Y - orients the sky over the scene
        // without disturbing the time of day driving the azimuth and elevation
        rotation: 0
    },
    // The haze of the sky over the distant terrain, its density as a fraction of HAZE_MAX_DENSITY
    haze: {
        enabled: true,
        density: 0.33,
        height: 40
    },
    effects: {
        ssao: true,
        bloom: true
    },
    // Night key light (the directional light fades to this once the sun is below the horizon)
    moon: {
        intensity: 1.0,
        color: [0.792, 0.918, 1.0],
        direction: [-1.53, 0.85, 0.35]
    },
    // Procedural night sky (gradient + twilight glow + stars + moon disk), shown below the horizon
    night: {
        color: [0.114, 0.247, 0.408],
        brightness: 0.052,
        starBrightness: 0.05,
        density: 0.8,
        starSize: 0.5,
        twilight: 0.52,
        moonSize: 0.6,
        moonGlow: 3
    },
    // Editable keyframe curves - each entry is an [x, y] pair, smoothstepped between keys.
    // These are exposed in the inspector as arrays of vec2 and rebuilt on the fly.
    curves: {
        elevation: [
            [0, -60],
            [6, 0],
            [12, 60],
            [18, 0],
            [24, -90]
        ], // x = hour,           y = elevation (deg)
        bloom: [
            [0, 0.005],
            [5, 0.001],
            [8, 0.001],
            [90, 0.002]
        ] // x = elevation (deg), y = bloom intensity
    }
});

// Build a Curve from an array of [x, y] keyframe pairs (as edited in the inspector)
const buildCurve = (pairs) => {
    const curve = new Curve(pairs.flat());
    curve.type = CURVE_SMOOTHSTEP;
    return curve;
};

const timeSpeed = 1; // hours per second

app.on('update', (dt) => {
    // Advance the time of day, skipping the (boring) night by jumping from 20:00 back to 05:00
    if (data.get('data.time.animate')) {
        let hour = data.get('data.time.hour') + dt * timeSpeed;
        if (hour >= 20) hour -= 15; // 20:00 -> 05:00
        data.set('data.time.hour', hour);
    }
    const hour = data.get('data.time.hour');

    // Rebuild the editable curves and evaluate them
    const elevation = buildCurve(data.get('data.curves.elevation')).value(hour);
    const bloomCurve = buildCurve(data.get('data.curves.bloom'));

    // Sun: elevation from the time curve, azimuth sweeping east -> west across the day
    sky.elevation = elevation;
    sky.azimuth = (hour / 24) * 360;

    // Sky look
    sky.rotation = data.get('data.sky.rotation');
    sky.turbidity = data.get('data.sky.turbidity');
    sky.rayleigh = data.get('data.sky.rayleigh');
    app.scene.exposure = data.get('data.sky.exposure');

    // Moonlight (night key light)
    sky.moonIntensity = data.get('data.moon.intensity');
    const mc = data.get('data.moon.color');
    sky.moonColor.set(mc[0], mc[1], mc[2]);
    const md = data.get('data.moon.direction');
    sky.moonDirection.set(md[0], md[1], md[2]);

    // Procedural night sky
    const nc = data.get('data.night.color');
    sky.nightColor.set(nc[0], nc[1], nc[2]);
    sky.nightBrightness = data.get('data.night.brightness');
    sky.starBrightness = data.get('data.night.starBrightness');
    sky.starDensity = data.get('data.night.density');
    sky.starSize = data.get('data.night.starSize');
    sky.twilightGlow = data.get('data.night.twilight');
    sky.moonSize = data.get('data.night.moonSize');
    sky.moonGlow = data.get('data.night.moonGlow');

    // Haze
    sky.haze = data.get('data.haze.enabled');
    sky.hazeDensity = data.get('data.haze.density') * HAZE_MAX_DENSITY;
    sky.hazeHeight = data.get('data.haze.height');

    // Bloom is a toggle whose intensity is driven by elevation, and SSAO is applied to the lighting
    cameraFrame.bloom.intensity = data.get('data.effects.bloom') ? bloomCurve.value(elevation) : 0;
    cameraFrame.ssao.type = data.get('data.effects.ssao') ? SSAOTYPE_LIGHTING : SSAOTYPE_NONE;

    // The settings of the sky and the other effects apply on the update of the camera frame
    cameraFrame.update();

    // Torches glow between sunset and sunrise
    const nightFactor = 1 - math.smoothstep(-3, 3, elevation);
    for (let i = 0; i < torchLights.length; i++) {
        torchLights[i].light.intensity = torchIntensity * nightFactor;
    }
});

export { app };
