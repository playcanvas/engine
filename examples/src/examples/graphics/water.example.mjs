// @config
//
// A configurable water surface rendered by the Water script - reflection, refraction, waves,
// foam, caustics and an underwater view.
//
// @credit
// title: Tropical Island
// author: Elin
// source: https://sketchfab.com/3d-models/tropical-island-f91862f8c38b481aa19edccac851eefb
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
// modifications: adapted for this example (see the credits file next to the asset)
//
// @credit
// title: Caustic Lighting
// author: Davis3D
// source: https://opengameart.org/content/caustic-lighting
// license: CC0 (https://creativecommons.org/publicdomain/zero/1.0/)

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { ProceduralSky } from 'playcanvas/scripts/esm/sky/procedural-sky.mjs';
import { Water } from 'playcanvas/scripts/esm/water.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the island glb is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    island: new pc.Asset('island', 'container', { url: './assets/models/tropical-island.glb' }),
    normal: new pc.Asset('normal', 'texture', { url: './assets/textures/normal-map.png' }),
    caustics: new pc.Asset('caustics', 'texture', { url: './assets/textures/caustics.jpg' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // get existing layers
    const worldLayer = app.scene.layers.getLayerByName('World');
    const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
    const uiLayer = app.scene.layers.getLayerByName('UI');

    // create a layer for the water plane, so it can be excluded from the reflection / refraction
    // rendering. It renders after the skybox, as the water blends over the whole scene.
    const waterLayer = new pc.Layer({ name: 'Water' });
    app.scene.layers.insert(waterLayer, app.scene.layers.getTransparentIndex(worldLayer) + 1);

    // the tropical island, with its terrain continuing below the water line
    const islandEntity = assets.island.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    });
    app.root.addChild(islandEntity);

    // a second copy of the island close by, rotated and sunk a bit deeper, so mostly the rocks
    // break the surface. The instantiated root carries the model's own rotation, so transform a
    // wrapper entity instead.
    const islandEntity2 = new pc.Entity('Island2');
    islandEntity2.addChild(assets.island.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    }));
    islandEntity2.setLocalPosition(15.5, -0.59, -10.9);
    islandEntity2.setLocalEulerAngles(0, 140, 0);
    app.root.addChild(islandEntity2);

    // the island textures have lighting baked in, so dim their albedo to compensate for the
    // dynamic sun and sky lighting applied on top (materials are shared by both instances).
    // Also enable the water's per-pixel underwater effects on them: height-gated fog and caustics
    const islandMaterials = new Set();
    islandEntity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach(mi => islandMaterials.add(mi.material));
    });
    islandMaterials.forEach((material) => {
        material.diffuse.set(0.55, 0.55, 0.55);
        material.setDefine('WATER_HEIGHT_FOG', true);
        material.setDefine('WATER_CAUSTICS', true);
        material.update();
    });

    // underwater fog - the water script's fog chunk limits it to fragments below the water level
    app.scene.fog.type = pc.FOG_EXP;

    // directional light (the sun), lighting the scene and the water. Its direction, color and
    // intensity are driven by the procedural sky script based on the time of day.
    const sun = new pc.Entity('Sun');
    sun.addComponent('light', {
        type: 'directional',
        intensity: 1.3,
        castShadows: true,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shadowDistance: 120
    });
    app.root.addChild(sun);

    // procedural sky - renders the visible sky and generates the image-based lighting
    const sky = new pc.Entity('ProceduralSky');
    sky.addComponent('script');
    const skyScript = /** @type {ProceduralSky} */ (sky.script.create(ProceduralSky));
    skyScript.sunLight = sun;
    skyScript.moonIntensity = 0.4;
    app.root.addChild(sky);

    // main camera, renders also the water layer. Tone mapping is handled by the CameraFrame,
    // so the camera (and the water's internal cameras which follow it) stays linear.
    const camera = new pc.Entity('MainCamera');
    camera.addComponent('camera', {
        fov: 60,
        farClip: 3000,
        layers: [worldLayer.id, pc.LAYERID_DEPTH, skyboxLayer.id, waterLayer.id, uiLayer.id]
    });
    camera.setLocalPosition(35, 13, 42);
    app.root.addChild(camera);

    // orbit camera controls
    camera.addComponent('script');
    const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
    // orbit around the center point between the two islands
    cameraControls.focusPoint = new pc.Vec3(8, 0, -5);
    // allow diving below the water surface
    cameraControls.pitchRange = new pc.Vec2(-90, 89);
    cameraControls.zoomRange = new pc.Vec2(2, 150);

    // HDR rendering with bloom, matching the procedural-sky example - the bright sun and its
    // specular glints on the water bloom
    const cameraFrame = new pc.CameraFrame(app, camera.camera);
    cameraFrame.rendering.toneMapping = pc.TONEMAP_NEUTRAL;
    cameraFrame.rendering.sceneDepthMap = true;
    cameraFrame.bloom.intensity = 0;
    cameraFrame.bloom.blurLevel = 16;
    cameraFrame.update();

    // sun elevation over the day - x = hour, y = elevation in degrees
    const elevationCurve = new pc.Curve([0, -60, 6, 0, 12, 60, 18, 0, 24, -90]);
    elevationCurve.type = pc.CURVE_SMOOTHSTEP;

    // sky luminance by sun elevation - brighter sky radiance at twilight, dimmer at midday
    const luminanceCurve = new pc.Curve([0, 2, 35, 0.4, 90, 0.3]);
    luminanceCurve.type = pc.CURVE_SMOOTHSTEP;

    // bloom intensity by sun elevation - stronger glow around the low sun
    const bloomCurve = new pc.Curve([0, 0.005, 5, 0.001, 8, 0.001, 90, 0.002]);
    bloomCurve.type = pc.CURVE_SMOOTHSTEP;
    let lastBloom = -1;

    // the fog color follows the daylight - without this, the constant bright fog color makes
    // fogged geometry glow through the transparent shore line at night
    let fogDayFactor = 1;
    const applyFogColor = () => {
        const c = data.get('data.fogColor');
        if (c) {
            app.scene.fog.color = new pc.Color(c[0] * fogDayFactor, c[1] * fogDayFactor, c[2] * fogDayFactor);
        }
    };

    /**
     * Positions the sun and adjusts the sky and bloom for the given time of day.
     *
     * @param {number} hour - The time of day in hours (0-24).
     */
    const applyTimeOfDay = (hour) => {
        const elevation = elevationCurve.value(hour);
        skyScript.elevation = elevation;
        skyScript.azimuth = (hour / 24) * 360;
        skyScript.luminance = luminanceCurve.value(Math.max(elevation, 0));

        // dim the underwater fog with the daylight (small floor for the moonlit night)
        const t = Math.max(0, Math.min(1, (elevation + 2) / 14));
        fogDayFactor = 0.05 + 0.95 * t * t * (3 - 2 * t);
        applyFogColor();

        const bloom = bloomCurve.value(Math.max(elevation, 0));
        if (bloom !== lastBloom) {
            lastBloom = bloom;
            cameraFrame.bloom.intensity = bloom;
            cameraFrame.update();
        }
    };

    // the water surface - a tessellated circle mesh, so the geometry waves can displace it. The
    // ring exponent concentrates the tessellation near the center, where the camera is, with the
    // cheap outer rings carrying the surface to the horizon
    const waterMesh = pc.Mesh.fromGeometry(device, new pc.CircleGeometry({
        radius: 1200,
        sectors: 180,
        rings: 150,
        ringExponent: 2.6
    }));
    const water = new pc.Entity('Water');
    water.addComponent('render', {
        meshInstances: [new pc.MeshInstance(waterMesh, new pc.StandardMaterial())],
        layers: [waterLayer.id],
        castShadows: false
    });
    // sea level of the island model
    water.setLocalPosition(0, -0.62, 0);
    app.root.addChild(water);

    // add the water script to it
    water.addComponent('script');
    const waterScript = /** @type {Water} */ (water.script.create(Water, {
        properties: {
            cameraEntity: camera,
            lightEntity: sun,
            normalMap: assets.normal.resource,
            causticsMap: assets.caustics.resource,
            waves: true
        }
    }));

    // water color presets
    const presets = {
        tropical: { shallowColor: new pc.Color(0.6, 0.9, 0.85), deepColor: new pc.Color(0.03, 0.16, 0.24), depthFade: 3 },
        ocean: { shallowColor: new pc.Color(0.35, 0.55, 0.6), deepColor: new pc.Color(0.01, 0.06, 0.12), depthFade: 6 },
        murky: { shallowColor: new pc.Color(0.5, 0.55, 0.35), deepColor: new pc.Color(0.1, 0.14, 0.05), depthFade: 1.2 }
    };

    let currentPreset = 'tropical';
    let fogBrightness = 0.35;

    // brighter blueish underwater fog, between the deep and shallow colors of the preset.
    // Pushed through the data observer, so the fog color picker stays in sync
    const updateFogColor = () => {
        const preset = presets[currentPreset];
        const fogColor = new pc.Color();
        fogColor.lerp(preset.deepColor, preset.shallowColor, fogBrightness);
        data.set('data.fogColor', [fogColor.r, fogColor.g, fogColor.b]);
    };

    /**
     * Applies a preset to the water and the matching underwater fog.
     *
     * @param {string} name - The preset name.
     */
    const applyPreset = (name) => {
        currentPreset = name;
        const preset = presets[name];
        waterScript.shallowColor = preset.shallowColor;
        waterScript.deepColor = preset.deepColor;
        waterScript.depthFade = preset.depthFade;
        updateFogColor();
        data.set('data.fogDensity', 0.45 / preset.depthFade);
    };

    /**
     * Applies a control value to the water script.
     *
     * @param {string} prop - The property name.
     * @param {any} value - The new value.
     */
    const applyProp = (prop, value) => {
        if (prop === 'timeOfDay') {
            applyTimeOfDay(value);
        } else if (prop === 'preset') {
            applyPreset(value);
        } else if (prop === 'fogDensity') {
            app.scene.fog.density = value;
        } else if (prop === 'fogBrightness') {
            fogBrightness = value;
            updateFogColor();
        } else if (prop === 'fogColor') {
            applyFogColor();
        } else if (prop === 'caustics') {
            islandMaterials.forEach((material) => {
                material.setDefine('WATER_CAUSTICS', value);
                material.update();
            });
        } else if (prop in waterScript) {
            waterScript[prop] = value;
        }
    };

    // apply control changes to the water script
    data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
        applyProp(path.split('.')[1], value);
    });

    // initial control values
    const initialData = {
        timeOfDay: 10,
        preset: 'tropical',
        reflectionSource: 'planar',
        reflectionStrength: 1,
        skyBlur: 0,
        refraction: true,
        distortion: 0.03,
        opacity: 0.8,
        obliqueClipping: true,
        clipBias: 0.1,
        textureScale: 0.5,
        depthEffects: true,
        shoreSoftness: 0.3,
        bumpiness: 0.4,
        rippleTiling: 0.08,
        rippleSpeed: 0.05,
        fresnelPower: 5,
        specularPower: 256,
        specularIntensity: 1,
        diffuseIntensity: 0.35,
        foam: true,
        foamDepth: 0.5,
        caustics: true,
        causticsStrength: 1.5,
        causticsTiling: 0.09,
        causticsSpeed: 0.04,
        causticsDepth: 3,
        snellWindow: 0.6,
        fogDensity: 0.15,
        fogBrightness: 0.35,
        fogColor: [0.23, 0.42, 0.45],
        waves: true,
        waveAmplitude: 0.12,
        waveLength: 12,
        waveSpeed: 1,
        waveSteepness: 0.4,
        waveDirection: 0,
        swellAmplitude: 0.25,
        swellLength: 35,
        swellSpeed: 1,
        swellDirection: 40
    };
    data.set('data', initialData);
    Object.entries(initialData).forEach(([prop, value]) => applyProp(prop, value));
});
