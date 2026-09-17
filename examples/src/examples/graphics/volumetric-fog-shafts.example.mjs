// @config
//
// Shafts of light cast through the holes of a carbon 60 sphere by the volumetric fog. Two spot
// lights orbit the sphere from the outside and shine through it, and an omni light sits at its
// center, its light radiating out through the holes. Either can be enabled on its own or both
// together.
//
// @credit
// title: CARBON 60 SPHERE
// author: Random13
// source: https://sketchfab.com/3d-models/carbon-60-sphere-5ef45e632eb8431998400ea73ddc51a5
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_CLAMP_TO_EDGE,
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
    FILTER_LINEAR,
    LIGHTFALLOFF_LINEAR,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_NEUTRAL,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    sphere: new Asset('carbon-sphere', 'container', { url: './assets/models/carbon-sphere.glb' })
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
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
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

data.set('settings', {
    fog: {
        enabled: true,
        density: 0.0015,
        extinction: 1,
        maxDistance: 2500,
        anisotropy: 0.6,

        // the shadow map texels of the cage are extruded along each beam, and enough steps are
        // needed for the march to average them out rather than alias on them
        steps: 32,
        scale: 0.5,
        taa: true
    },
    lights: {
        spot: true,
        omni: false,
        intensity: 22,
        shadows: true,
        cookie: false,
        animate: true
    }
});

// The lights sample both the shadow and the cookie atlas of the clustered lighting. A large shadow
// atlas keeps the many small holes of the sphere sharp in the shafts.
app.scene.lighting.shadowAtlasResolution = 4096;
app.scene.lighting.cookieAtlasResolution = 2048;
app.scene.lighting.cookiesEnabled = true;

// no environment lighting, the sphere is lit by the local lights alone
app.scene.ambientLight = new Color(0.02, 0.022, 0.03);

// The carbon 60 sphere, a cage of hexagons and pentagons the light shines through. The model is
// roughly 52 units in radius, so it is scaled to the size the scene is built around.
const SPHERE_MODEL_RADIUS = 52;
const SPHERE_RADIUS = 90;

const sphere = assets.sphere.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
const sphereScale = SPHERE_RADIUS / SPHERE_MODEL_RADIUS;
sphere.setLocalScale(sphereScale, sphereScale, sphereScale);
app.root.addChild(sphere);

// A video texture used as an optional cookie of the spot lights, uploaded every frame so that the
// pattern inside the shafts animates
const videoCookie = new Texture(app.graphicsDevice, {
    name: 'videoCookie',
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});

/** @type {HTMLVideoElement} */
const video = document.createElement('video');
video.loop = true;
video.muted = true;
video.autoplay = true;
video.playsInline = true;
video.crossOrigin = 'anonymous';

// Keep the video element in view (but invisible) so it loads / plays on all browsers
video.setAttribute(
    'style',
    'display: block; width: 1px; height: 1px; position: absolute; opacity: 0; z-index: -1000; top: 0px; pointer-events: none'
);
video.src = './assets/video/SampleVideo_1280x720_1mb.mp4';
document.body.append(video);
const onCanPlay = () => videoCookie.setSource(video);
video.addEventListener('canplaythrough', onCanPlay);
video.load();

// autoplay of a muted video is still blocked in some browsers, so start it explicitly and ignore
// the rejection when even that is not allowed - the cookie then stays on the first frame
video.play().catch(() => {});

// Clean up the video when the app is destroyed, so a late 'canplaythrough' does not call setSource
// on an already torn-down graphics device
app.on('destroy', () => {
    video.removeEventListener('canplaythrough', onCanPlay);
    video.pause();
    video.remove();
});

// Two spot lights orbiting the sphere at its own height, so their center rays run parallel to the
// ground and shine straight through the cage
const spotOrbitRadius = 240;
const spotColors = [new Color(0.5, 0.8, 1), new Color(1, 0.75, 0.5)];

/** @type {Array<Entity>} */
const spotLights = spotColors.map((color, index) => {
    const spot = new Entity(`Spot-${index}`);
    spot.addComponent('light', {
        type: 'spot',
        color: color,
        intensity: 15,
        range: 600,
        falloffMode: LIGHTFALLOFF_LINEAR,

        // wide enough for the cone to cover the whole sphere, so the holes shape the shafts
        innerConeAngle: 14,
        outerConeAngle: 23,
        castShadows: true,
        shadowBias: 0.06,
        normalOffsetBias: 0.03,
        shadowType: SHADOW_PCF3_32F,
        cookie: videoCookie,
        cookieChannel: 'rgb',
        cookieIntensity: 0
    });
    app.root.addChild(spot);
    return spot;
});

// A single omni light at the center of the sphere, its light radiating out through the holes. Omni
// lights are not given a cookie here.
const omniLight = new Entity('Omni');
omniLight.addComponent('light', {
    type: 'omni',
    color: new Color(1, 0.8, 0.55),
    intensity: 5,
    range: 320,
    falloffMode: LIGHTFALLOFF_LINEAR,
    castShadows: true,
    shadowBias: 0.06,
    normalOffsetBias: 0.03,
    shadowType: SHADOW_PCF3_32F,

    // An omni light spreads its energy over every direction rather than into a narrow cone, so it
    // needs a fraction of the scattering of the spot lights. Raising this much above 0.2 brightens
    // the glow right around the light faster than the distant shafts, which then lose definition.
    volumetricScattering: 0.2
});
omniLight.setLocalPosition(0, 0, 0);
app.root.addChild(omniLight);

// A small emissive sphere marking the omni light
const bulbMaterial = new StandardMaterial();
bulbMaterial.emissive = new Color(1, 0.8, 0.55);
bulbMaterial.diffuse = new Color(0, 0, 0);
bulbMaterial.update();

const bulb = new Entity('Bulb');
bulb.addComponent('render', {
    type: 'sphere',
    material: bulbMaterial,
    castShadows: false
});
bulb.setLocalScale(6, 6, 6);
omniLight.addChild(bulb);

// Create an Entity with a camera component
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.01, 0.012, 0.02),
    nearClip: 1,
    farClip: 2000
});
camera.addComponent('script');
camera.setLocalPosition(-400, 150, 440);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 0, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-80, 25);
cameraControls.zoomRange = new Vec2(40, 900);

// Set up the camera frame rendering with TAA and the volumetric fog. No directional light is
// assigned to the fog - the local lights light it on their own.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.rendering.sharpness = 0.5;
cameraFrame.bloom.intensity = 0.015;
cameraFrame.volumetricFog.tint.set(0.9, 0.94, 1);
cameraFrame.volumetricFog.heightBase = 0;
cameraFrame.volumetricFog.heightFalloff = 0;
cameraFrame.volumetricFog.ambientColor.set(0.3, 0.45, 0.8);
cameraFrame.volumetricFog.ambientIntensity = 0.004;

// with no directional light, the main raymarch only accumulates the flat ambient term and the fog
// extinction, and so a low number of steps is enough for it
cameraFrame.volumetricFog.steps = 10;

const applySettings = () => {
    const { fog, lights } = data.get('settings');

    cameraFrame.taa.enabled = fog.taa;
    cameraFrame.volumetricFog.enabled = fog.enabled;
    cameraFrame.volumetricFog.density = fog.density;
    cameraFrame.volumetricFog.anisotropy = fog.anisotropy;
    cameraFrame.volumetricFog.extinction = fog.extinction;
    cameraFrame.volumetricFog.maxDistance = fog.maxDistance;
    cameraFrame.volumetricFog.localSteps = fog.steps;
    cameraFrame.volumetricFog.localIntensity = lights.intensity;
    cameraFrame.volumetricFog.scale = fog.scale;

    // each light type scatters light in the fog only while it is enabled
    cameraFrame.volumetricFog.localSpotLights = lights.spot;
    cameraFrame.volumetricFog.localOmniLights = lights.omni;
    cameraFrame.update();

    spotLights.forEach((spot) => {
        spot.enabled = lights.spot;
        spot.light.castShadows = lights.shadows;
        spot.light.cookieIntensity = lights.cookie ? 1 : 0;
    });

    omniLight.enabled = lights.omni;
    omniLight.light.castShadows = lights.shadows;
};
applySettings();

// Handle HUD changes
data.on('*:set', () => applySettings());

const lightPosition = new Vec3();
let lightTime = 0;
app.on('update', (/** @type {number} */ dt) => {
    if (data.get('settings.lights.animate')) {
        lightTime += dt;
    }

    // slowly tumble the sphere, which sweeps its holes across the light
    sphere.setLocalEulerAngles(lightTime * 3, lightTime * 7, 0);

    // orbit the spot lights around the sphere, both aiming at its center
    spotLights.forEach((spot, index) => {
        const angle = (index / spotLights.length) * Math.PI * 2 + lightTime * 0.25;
        lightPosition.set(spotOrbitRadius * Math.sin(angle), 0, spotOrbitRadius * Math.cos(angle));
        spot.setLocalPosition(lightPosition);

        // spot lights shine down their negative Y axis, so the entity is rotated after aiming it
        spot.lookAt(Vec3.ZERO, Vec3.RIGHT);
        spot.rotateLocal(90, 0, 0);
    });

    // upload the latest video frame to the cookie texture shared by the spot lights
    videoCookie.upload();
});
