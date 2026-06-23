// @config
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

import * as pc from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import { ProceduralSky } from 'playcanvas/scripts/esm/sky/procedural-sky.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    laboratory: new pc.Asset('statue', 'container', { url: './assets/models/laboratory.glb' }),
    terrain: new pc.Asset('terrain', 'container', { url: './assets/models/dry-sand-terrain.glb' })
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

    // get the instance of the laboratory
    const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    });
    laboratoryEntity.setLocalScale(100, 100, 100);
    app.root.addChild(laboratoryEntity);

    // set up materials to use SSAO only (disable baked AO map)
    laboratoryEntity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((meshInstance) => {
            meshInstance.material.depthState = pc.DepthState.DEFAULT;
            meshInstance.material.blendType = pc.BLEND_NONE;
            meshInstance.material.aoMap = null;
            meshInstance.material.update();
        });
    });

    // detect the torches in the model (all named 'Fackel*') and add a warm omni light at each.
    // Their intensity is driven by the day/night cycle so they only glow between sunset and sunrise.
    const torchIntensity = 60;
    const torchLights = [];
    laboratoryEntity.find(node => node.name.indexOf('Fackel') !== -1).forEach((torch) => {
        const render = torch.findComponent('render');
        if (!render) return;

        const light = new pc.Entity('Torch');
        light.addComponent('light', {
            type: 'omni',
            color: new pc.Color(1.0, 0.55, 0.2),
            intensity: 0,
            range: 480,
            // keep the warm light contained to the torch's surroundings
            falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED
        });
        // place at the flame's world-space position
        light.setPosition(render.meshInstances[0].aabb.center);
        app.root.addChild(light);
        torchLights.push(light);
    });

    // use the dry-sand terrain as the ground. Instantiate it, measure its native bounds, scale it
    // up to cover the scene out to the horizon, and drop it so its surface sits where the lab rests.
    const terrain = assets.terrain.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    });
    app.root.addChild(terrain);

    // accumulate the native (unscaled) world bounds of all the terrain mesh instances
    const terrainMeshes = terrain.findComponents('render').flatMap(render => render.meshInstances);
    const terrainAabb = new pc.BoundingBox();
    terrainMeshes.forEach((mi, i) => (i === 0 ? terrainAabb.copy(mi.aabb) : terrainAabb.add(mi.aabb)));

    // scale so the terrain spans ~3000 units (out to the camera far clip), then centre it on the lab
    // and lower it so the top of the terrain sits near the old ground height, plus a hand-tuned
    // offset that beds the laboratory nicely into the dunes
    const groundLevel = -40;
    const terrainScale = 3000 / (2 * Math.max(terrainAabb.halfExtents.x, terrainAabb.halfExtents.z));
    terrain.setLocalScale(terrainScale, terrainScale, terrainScale);

    const tc = terrainAabb.center;
    const terrainTop = (tc.y + terrainAabb.halfExtents.y) * terrainScale;
    terrain.setLocalPosition(
        -tc.x * terrainScale - 71.6,
        groundLevel - terrainTop + 267.1,
        -tc.z * terrainScale + 395.8
    );

    // dim the terrain albedo (diffuse) by 0.5 to balance the bright sand against the darker building.
    // Scaling diffuse multiplies the albedo texture, darkening the surface in direct and ambient light.
    const dimmedTerrainMaterials = new Set();
    terrain.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((mi) => {
            const material = mi.material;
            if (dimmedTerrainMaterials.has(material)) return;
            dimmedTerrainMaterials.add(material);
            material.diffuse.set(material.diffuse.r * 0.5, material.diffuse.g * 0.5, material.diffuse.b * 0.5);
            material.update();
        });
    });

    // a single directional light, kept in sync with the sun by the procedural sky script. It uses
    // PCSS soft shadows so the shadow penumbra reacts to the (moving) sun.
    const sunLight = new pc.Entity('Sun');
    sunLight.addComponent('light', {
        type: 'directional',
        castShadows: true,
        // daytime peak intensity - the procedural sky captures this and fades it across the day/night cycle
        intensity: 6,
        shadowType: pc.SHADOW_PCSS_32F,
        penumbraSize: 0.03,
        penumbraFalloff: 2.1,
        shadowSamples: 16,
        shadowBlockerSamples: 16,
        shadowResolution: 2048,
        // 4 cascades: each covers a smaller area at the same resolution, giving tighter shadow
        // texels close to the camera (less acne)
        numCascades: 4,
        cascadeDistribution: 0.35,
        shadowBias: 0.18,
        normalOffsetBias: 0.82,
        shadowDistance: 2400,
        // the sun moves every frame, so the shadow map must be re-rendered in realtime
        // (SHADOWUPDATE_THISFRAME would render it once and then stop)
        shadowUpdateMode: pc.SHADOWUPDATE_REALTIME
    });
    app.root.addChild(sunLight);

    // procedural sky - renders the visible sky and generates the image-based lighting, driving the
    // sun light's direction, color and intensity
    const sky = new pc.Entity('ProceduralSky');
    sky.addComponent('script');
    const skyScript = sky.script.create(ProceduralSky);
    skyScript.sunLight = sunLight;
    app.root.addChild(sky);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity('Camera');
    cameraEntity.addComponent('camera', {
        farClip: 3000,
        fov: 80, // wide angle so more of the sky is visible
        toneMapping: pc.TONEMAP_NEUTRAL
    });
    cameraEntity.setLocalPosition(240, 85, 240);
    cameraEntity.addComponent('script');
    app.root.addChild(cameraEntity);

    // add camera controls, framing the model with the sky behind it
    const cc = /** @type {any} */ (cameraEntity.script.create(CameraControls));
    cc.focusPoint = new pc.Vec3(0, 25, 0);
    // limit how far the camera can orbit out, keeping it in the sharp near-cascade zone (x = min, y = max)
    cc.zoomRange = new pc.Vec2(1, 500);

    // ------ Custom render passes set up ------

    const cameraFrame = new pc.CameraFrame(app, cameraEntity.camera);
    cameraFrame.rendering.toneMapping = pc.TONEMAP_NEUTRAL;

    // 16bit render target for HDR, so the bright sun blooms and SSAO has better precision
    cameraFrame.rendering.renderFormats = [pc.PIXELFORMAT_RGBA16F];

    // SSAO, applied to the ambient lighting (not as a post-process), toggled from the UI
    cameraFrame.ssao.type = pc.SSAOTYPE_LIGHTING;
    cameraFrame.ssao.blurEnabled = true;
    cameraFrame.ssao.intensity = 0.4;
    cameraFrame.ssao.power = 6;
    cameraFrame.ssao.radius = 30;
    cameraFrame.ssao.samples = 12;
    cameraFrame.ssao.minAngle = 10;

    // HDR bloom, off by default (blurLevel left at its default of 16)
    cameraFrame.bloom.intensity = 0;
    cameraFrame.bloom.blurLevel = 16;

    cameraFrame.update();

    // SSAO toggles the CameraFrame SSAO type, which needs an explicit update()
    data.on('data.effects.ssao:set', (/** @type {boolean} */ value) => {
        cameraFrame.ssao.type = value ? pc.SSAOTYPE_LIGHTING : pc.SSAOTYPE_NONE;
        cameraFrame.update();
    });

    // initial control values
    data.set('data', {
        time: {
            hour: 9,
            animate: true
        },
        sky: {
            turbidity: 7,
            rayleigh: 1,
            exposure: 1.8
        },
        effects: {
            ssao: true,
            bloom: true
        },
        // night key light (the directional light fades to this once the sun is below the horizon)
        moon: {
            intensity: 1.0,
            color: [0.792, 0.918, 1.0],
            direction: [-1.53, 0.85, 0.35]
        },
        // procedural night sky (gradient + twilight glow + stars + moon disk), shown below the horizon
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
        // editable keyframe curves - each entry is an [x, y] pair, smoothstepped between keys.
        // These are exposed in the inspector as arrays of vec2 and rebuilt on the fly.
        curves: {
            elevation: [[0, -60], [6, 0], [12, 60], [18, 0], [24, -90]],  // x = hour,           y = elevation (deg)
            luminance: [[0, 2], [35, 0.4], [90, 0.3]],                    // x = elevation (deg), y = luminance
            bloom: [[0, 0.005], [5, 0.001], [8, 0.001], [90, 0.002]]      // x = elevation (deg), y = bloom intensity
        }
    });

    // build a pc.Curve from an array of [x, y] keyframe pairs (as edited in the inspector)
    const buildCurve = (pairs) => {
        const curve = new pc.Curve(pairs.flat());
        curve.type = pc.CURVE_SMOOTHSTEP;
        return curve;
    };

    let lastBloom = -1;
    const timeSpeed = 1; // hours per second

    app.on('update', (dt) => {

        // advance the time of day, skipping the (boring) night by jumping from 20:00 back to 05:00
        if (data.get('data.time.animate')) {
            let hour = data.get('data.time.hour') + dt * timeSpeed;
            if (hour >= 20) hour -= 15; // 20:00 -> 05:00
            data.set('data.time.hour', hour);
        }
        const hour = data.get('data.time.hour');

        // rebuild the editable curves and evaluate them
        const elevation = buildCurve(data.get('data.curves.elevation')).value(hour);
        const luminance = buildCurve(data.get('data.curves.luminance')).value(elevation);
        const bloomCurve = buildCurve(data.get('data.curves.bloom'));

        // sun: elevation from the time curve, azimuth sweeping east -> west across the day
        skyScript.elevation = elevation;
        skyScript.azimuth = hour / 24 * 360;

        // sky look
        skyScript.luminance = luminance;
        skyScript.turbidity = data.get('data.sky.turbidity');
        skyScript.rayleigh = data.get('data.sky.rayleigh');
        app.scene.exposure = data.get('data.sky.exposure');

        // moonlight (night key light)
        skyScript.moonIntensity = data.get('data.moon.intensity');
        const mc = data.get('data.moon.color');
        skyScript.moonColor.set(mc[0], mc[1], mc[2]);
        const md = data.get('data.moon.direction');
        skyScript.moonDirection.set(md[0], md[1], md[2]);

        // procedural night sky
        const nc = data.get('data.night.color');
        skyScript.nightColor.set(nc[0], nc[1], nc[2]);
        skyScript.nightBrightness = data.get('data.night.brightness');
        skyScript.starBrightness = data.get('data.night.starBrightness');
        skyScript.starDensity = data.get('data.night.density');
        skyScript.starSize = data.get('data.night.starSize');
        skyScript.twilightGlow = data.get('data.night.twilight');
        skyScript.moonSize = data.get('data.night.moonSize');
        skyScript.moonGlow = data.get('data.night.moonGlow');

        // bloom is a toggle whose intensity is driven by elevation - CameraFrame needs update() on change
        const bloom = data.get('data.effects.bloom') ? bloomCurve.value(elevation) : 0;
        if (bloom !== lastBloom) {
            cameraFrame.bloom.intensity = bloom;
            cameraFrame.update();
            lastBloom = bloom;
        }

        // torches glow between sunset and sunrise
        const nightFactor = 1 - pc.math.smoothstep(-3, 3, elevation);
        for (let i = 0; i < torchLights.length; i++) {
            torchLights[i].light.intensity = torchIntensity * nightFactor;
        }
    });
});

export { app };
