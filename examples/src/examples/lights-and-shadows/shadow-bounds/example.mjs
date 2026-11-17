// @config
//
// A directional light renders its shadow into a single shadow map fitted to the shadow bounds (the
// box), which follow the bouncing sphere, keeping its shadow sharp. Compare with the shadow map of
// the same resolution fitted to the camera frustum, spread over the whole shadow distance.
//
// @credit
// title: CARBON 60 SPHERE
// author: Random13
// source: https://sketchfab.com/3d-models/carbon-60-sphere-5ef45e632eb8431998400ea73ddc51a5
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLUR_BOX,
    BLUR_GAUSSIAN,
    BoundingBox,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WasmModule,
    WireRenderer,
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

const groundPath = './assets/textures/ground092c';
const assets = {
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/morning-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    sphere: new Asset('carbon-sphere', 'container', { url: './assets/models/carbon-sphere.glb' }),
    color: new Asset('color', 'texture', { url: `${groundPath}/color.webp` }, { srgb: true }),
    normal: new Asset('normal', 'texture', { url: `${groundPath}/normal.webp` }),
    roughness: new Asset('roughness', 'texture', { url: `${groundPath}/roughness.webp` }),
    ao: new Asset('ao', 'texture', { url: `${groundPath}/ao.webp` })
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
    shadow: {
        mode: 'bounds',
        type: SHADOW_PCF3_32F,
        resolution: 512,
        showBounds: true
    },
    sun: {
        elevation: 45,
        rotate: false
    },
    bounce: true
});

app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxMip = 2;
app.scene.skyboxIntensity = 0.5;
app.scene.exposure = 0.8;

// A large ground, which only receives the shadow
const GROUND_SIZE = 100;
const TEXTURE_TILING = new Vec2(GROUND_SIZE / 4, GROUND_SIZE / 4);
const groundMaterial = new StandardMaterial();
groundMaterial.diffuseMap = assets.color.resource;
groundMaterial.normalMap = assets.normal.resource;
groundMaterial.aoMap = assets.ao.resource;
groundMaterial.glossMap = assets.roughness.resource;
groundMaterial.glossInvert = true;
groundMaterial.useMetalness = true;
groundMaterial.metalness = 0;
groundMaterial.diffuseMapTiling = TEXTURE_TILING;
groundMaterial.normalMapTiling = TEXTURE_TILING;
groundMaterial.aoMapTiling = TEXTURE_TILING;
groundMaterial.glossMapTiling = TEXTURE_TILING;
groundMaterial.update();

const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'plane',
    material: groundMaterial,
    castShadows: false
});
ground.setLocalScale(GROUND_SIZE, 1, GROUND_SIZE);
app.root.addChild(ground);

// The carbon 60 sphere, a cage of hexagons and pentagons, so its shadow shows how sharp the shadow
// map is. The model is roughly 52 units in radius.
const SPHERE_MODEL_RADIUS = 52;
const SPHERE_RADIUS = 1;
const sphere = assets.sphere.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
const sphereScale = SPHERE_RADIUS / SPHERE_MODEL_RADIUS;
sphere.setLocalScale(sphereScale, sphereScale, sphereScale);
app.root.addChild(sphere);

// The sun. Without the shadow bounds, its shadow map of the same resolution is fitted to the camera
// frustum, up to the shadow distance.
const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.95, 0.85),
    intensity: 2,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    numCascades: 1,
    shadowDistance: 40,
    shadowBias: 0.2,
    normalOffsetBias: 0.02,

    // the penumbra of PCSS grows by this fraction of the distance from the caster, so the shadow
    // blurs as the sphere bounces up. The falloff of 1 keeps it growing all the way up, larger
    // values soften the shadow sooner
    penumbraSize: 0.08,
    penumbraFalloff: 1
});
app.root.addChild(sun);

// The camera orbiting the sphere
const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    nearClip: 0.1,
    farClip: 300,
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.setLocalPosition(-4.5, 6, 6.5);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 2.5, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-85, -5);
cameraControls.zoomRange = new Vec2(2, 60);

// The shadow bounds, which follow the sphere. They only need to cover the sphere, as the ground
// below it, further along the light, is shadowed by the casters within the bounds.
const bounds = new BoundingBox(new Vec3(), new Vec3(SPHERE_RADIUS, SPHERE_RADIUS, SPHERE_RADIUS));
const wire = new WireRenderer(app);
wire.color = new Color(0, 0, 0);

const applySettings = () => {
    const { shadow } = data.get('settings');
    sun.light.shadowType = shadow.type;
    sun.light.shadowResolution = shadow.resolution;

    // VSM blurs over a number of texels. The texels of the shadow bounds are much smaller than the
    // texels of the shadow fitted to the camera frustum, so the bounds use the widest blur to look
    // soft, which would blur the other shadow away
    const useBounds = shadow.mode === 'bounds';
    sun.light.vsmBlurSize = useBounds ? 25 : 11;
    sun.light.vsmBlurMode = useBounds ? BLUR_BOX : BLUR_GAUSSIAN;
};
applySettings();
data.on('*:set', applySettings);

// The sphere bounces on the spot
const BOUNCE_HEIGHT = 2.25;
const BOUNCE_SPEED = 2.5;
const position = new Vec3(0, SPHERE_RADIUS, 0);
const sunRotation = new Quat();
const sunDirection = new Vec3();

let bounceTime = 0;
let sunAzimuth = 30;

app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');

    // bounce the sphere
    if (settings.bounce) {
        bounceTime += dt;
    }
    position.y = SPHERE_RADIUS + BOUNCE_HEIGHT * Math.abs(Math.sin(bounceTime * BOUNCE_SPEED));
    sphere.setPosition(position);

    // the sun, shining down at the elevation, slowly turning around when enabled
    if (settings.sun.rotate) {
        sunAzimuth += dt * 10;
    }
    const elevation = settings.sun.elevation * (Math.PI / 180);
    const azimuth = sunAzimuth * (Math.PI / 180);
    sunDirection.set(
        -Math.cos(elevation) * Math.sin(azimuth),
        -Math.sin(elevation),
        -Math.cos(elevation) * Math.cos(azimuth)
    );
    sun.setRotation(sunRotation.setFromDirections(Vec3.DOWN, sunDirection));

    // the shadow bounds follow the sphere, or the shadow is fitted to the camera frustum
    if (settings.shadow.mode === 'bounds') {
        bounds.center.copy(position);
        sun.light.shadowBounds = bounds;

        if (settings.shadow.showBounds) {
            wire.box(bounds);
        }
    } else {
        sun.light.shadowBounds = null;
    }
});
