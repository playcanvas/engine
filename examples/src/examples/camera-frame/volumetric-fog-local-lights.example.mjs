// @config
//
// @credit
// title: Terrain Low Poly
// author: Sketchfab
// source: https://sketchfab.com/3d-models/terrain-low-poly-248b21331315466e98d20c441935d99d
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LIGHTFALLOFF_LINEAR,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    terrain: new Asset('terrain', 'container', { url: './assets/models/terrain.glb' }),
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('settings', {
    fog: {
        enabled: true,
        density: 0.011,
        anisotropy: 0.55,
        intensity: 0.4,
        steps: 24,
        scale: 0.5,
        taa: true
    },
    local: {
        omni: true,
        spot: true,
        intensity: 15,
        steps: 16,
        shadows: true,
        animate: true
    }
});

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Setup a dim skydome, to give the scene a dusk feel where the local lights dominate
app.scene.skyboxMip = 3;
app.scene.skyboxIntensity = 0.15;
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, -70, 0);

// The local lights of the volumetric fog sample the shadow atlas of the clustered lighting, which
// is enabled by default. A larger atlas gives the shadows of the beams more detail.
app.scene.lighting.shadowAtlasResolution = 2048;

// Instantiate the terrain
/** @type {Entity} */
const terrain = assets.terrain.resource.instantiateRenderEntity();
terrain.setLocalScale(30, 30, 30);
app.root.addChild(terrain);

// Get the clouds so that we can animate them
/** @type {Array<Entity>} */
const srcClouds = terrain.find((node) => {
    const isCloud = node.name.includes('Icosphere');

    if (isCloud) {
        // No shadow receiving for clouds
        node.render.receiveShadows = false;
    }

    return isCloud;
});

// Clone some additional clouds
/** @type {Array<Entity>} */
const clouds = [];
srcClouds.forEach((cloud) => {
    clouds.push(cloud);

    for (let i = 0; i < 3; i++) {
        /** @type {Entity} */
        const clone = cloud.clone();
        cloud.parent.addChild(clone);
        clouds.push(clone);
    }
});

// Shuffle the array to give clouds random order
clouds.sort(() => Math.random() - 0.5);

// A large orange pillar, casting a long shaft through the fog
const material = new StandardMaterial();
material.diffuse = new Color(1, 0.5, 0);
const pillar = new Entity('pillar');
pillar.addComponent('render', {
    type: 'box',
    material: material
});
pillar.setLocalScale(10, 130, 10);
pillar.setLocalPosition(180, 50, 110);
app.root.addChild(pillar);

// Find a tree in the middle to use as a focus point
const tree = terrain.findOne('name', 'Arbol 2.002');

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.02, 0.03, 0.06),
    farClip: 1000
});

// And position it in the world
camera.setLocalPosition(-500, 160, 300);

// Add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: tree,
        distanceMax: 600
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// A dim directional light acting as the moon, still casting long shafts through the fog
const dirLight = new Entity('MainLight');
dirLight.addComponent('light', {
    type: 'directional',
    color: new Color(0.6, 0.75, 1),
    shadowBias: 0.3,
    normalOffsetBias: 0.2,
    intensity: 0.7,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowResolution: 2048,
    shadowDistance: 1000
});
dirLight.setLocalEulerAngles(65, 20, 0);
app.root.addChild(dirLight);

// Sweeping spot lights. Those use a linear falloff, which keeps their beams bright over the whole
// range of the light, and so reads well over the large scale of this scene.
/** @type {Array<Entity>} */
const spotLights = [];
const spotColors = [new Color(0.3, 0.7, 1), new Color(1, 0.35, 0.7), new Color(1, 0.8, 0.35)];
spotColors.forEach((color, index) => {
    const spot = new Entity(`Spot-${index}`);
    spot.addComponent('light', {
        type: 'spot',
        color: color,
        intensity: 0.7,
        range: 400,
        falloffMode: LIGHTFALLOFF_LINEAR,
        innerConeAngle: 6,
        outerConeAngle: 18,
        castShadows: true,
        shadowBias: 0.3,
        normalOffsetBias: 0.2,

        // the narrow beams of the sweeping lights cross only a short part of each view ray,
        // and so they need to scatter considerably more than the wide volumes of the omni lights
        // for them to read as the main feature of the scene
        volumetricScattering: 15
    });
    app.root.addChild(spot);
    spotLights.push(spot);
});

// Omni lights drifting just above the terrain, each with a small emissive sphere marking it
/** @type {Array<Entity>} */
const omniLights = [];
const omniColors = [new Color(1, 0.5, 0.15), new Color(0.4, 1, 0.6), new Color(0.6, 0.5, 1), new Color(1, 0.3, 0.3)];
omniColors.forEach((color, index) => {
    const omni = new Entity(`Omni-${index}`);
    omni.addComponent('light', {
        type: 'omni',
        color: color,
        intensity: 0.35,
        range: 150,
        falloffMode: LIGHTFALLOFF_LINEAR,
        castShadows: false
    });

    const bulbMaterial = new StandardMaterial();
    bulbMaterial.emissive = color;
    bulbMaterial.update();
    omni.addComponent('render', {
        type: 'sphere',
        material: bulbMaterial,
        castShadows: false
    });
    omni.setLocalScale(8, 8, 8);

    app.root.addChild(omni);
    omniLights.push(omni);
});

// Set up the camera frame rendering with TAA, a subtle bloom and the volumetric fog
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.rendering.sharpness = 0.5;
cameraFrame.bloom.intensity = 0.015;
cameraFrame.volumetricFog.light = dirLight.light;
cameraFrame.volumetricFog.tint.set(0.75, 0.85, 1);
cameraFrame.volumetricFog.heightBase = -74;
cameraFrame.volumetricFog.heightFalloff = 0.008;
cameraFrame.volumetricFog.ambientColor.set(0.2, 0.3, 0.5);
cameraFrame.volumetricFog.ambientIntensity = 0.018;
cameraFrame.volumetricFog.maxDistance = 700;

const applySettings = () => {
    const { fog, local } = data.get('settings');

    cameraFrame.taa.enabled = fog.taa;
    cameraFrame.volumetricFog.enabled = fog.enabled;
    cameraFrame.volumetricFog.density = fog.density;
    cameraFrame.volumetricFog.anisotropy = fog.anisotropy;
    cameraFrame.volumetricFog.intensity = fog.intensity;
    cameraFrame.volumetricFog.steps = fog.steps;
    cameraFrame.volumetricFog.scale = fog.scale;

    // the fog scattering of the clustered lights, which is enabled per light type
    cameraFrame.volumetricFog.localOmniLights = local.omni;
    cameraFrame.volumetricFog.localSpotLights = local.spot;
    cameraFrame.volumetricFog.localIntensity = local.intensity;
    cameraFrame.volumetricFog.localSteps = local.steps;
    cameraFrame.update();

    spotLights.forEach((spot) => {
        spot.light.castShadows = local.shadows;
    });
};
applySettings();

// Handle HUD changes
data.on('*:set', () => applySettings());

const cloudSpeed = 0.2;
const lightTarget = new Vec3();
let frameNumber = 0;
let time = 0;
let lightTime = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;
    if (data.get('settings.local.animate')) {
        lightTime += dt;
    }

    // On the first frame, when camera is updated, frame the view over the lit valley
    if (frameNumber === 0) {
        // @ts-ignore engine-tsd
        camera.script.orbitCamera.distance = 470;
        // @ts-ignore engine-tsd
        camera.script.orbitCamera.yaw = 304;
        // @ts-ignore engine-tsd
        camera.script.orbitCamera.pitch = -6;
    }

    // Move the clouds around
    clouds.forEach((cloud, index) => {
        const radialOffset = (index / clouds.length) * (6.24 / cloudSpeed);
        const radius = 9 + 4 * Math.sin(radialOffset);
        const cloudTime = time + radialOffset;
        cloud.setLocalPosition(
            2 + radius * Math.sin(cloudTime * cloudSpeed),
            4,
            -5 + radius * Math.cos(cloudTime * cloudSpeed)
        );
    });

    // Sweep the spot lights over the terrain, orbiting high above it and aiming at a target which
    // circles the valley at a different rate
    spotLights.forEach((spot, index) => {
        const phase = (index / spotLights.length) * Math.PI * 2;
        spot.setLocalPosition(250 * Math.sin(phase + lightTime * 0.15), 145, 250 * Math.cos(phase + lightTime * 0.15));

        lightTarget.set(140 * Math.sin(phase - lightTime * 0.4), 5, 140 * Math.cos(phase - lightTime * 0.4));

        // spot lights shine down their negative Y axis, so the entity is rotated after aiming it
        spot.lookAt(lightTarget, Vec3.RIGHT);
        spot.rotateLocal(90, 0, 0);
    });

    // Drift the omni lights above the terrain
    omniLights.forEach((omni, index) => {
        const phase = (index / omniLights.length) * Math.PI * 2;
        omni.setLocalPosition(
            195 * Math.sin(phase + lightTime * 0.25),
            40 + 25 * Math.sin(phase + lightTime * 0.7),
            195 * Math.cos(phase + lightTime * 0.25)
        );
    });

    frameNumber++;
});
