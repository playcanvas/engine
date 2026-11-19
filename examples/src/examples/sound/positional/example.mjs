import {
    AnimClipHandler,
    AnimComponentSystem,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    AudioHandler,
    AudioListenerComponentSystem,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    EnvLighting,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCSS_32F,
    SKYTYPE_DOME,
    ScriptComponentSystem,
    SoundComponentSystem,
    SoundManager,
    TONEMAP_ACES,
    TextureHandler,
    Vec3,
    createGraphicsDevice,
    math
} from 'playcanvas';
import { ShadowCatcher } from 'playcanvas/scripts/esm/shadow-catcher.mjs';

import { deviceType } from 'examples/context';

/**
 * @import { Texture } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.soundManager = new SoundManager();

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    SoundComponentSystem,
    AnimComponentSystem,
    AudioListenerComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, AudioHandler, AnimClipHandler];

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

const assets = {
    model: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    runAnim: new Asset('runAnim', 'container', { url: './assets/animations/bitmoji/run.glb' }),
    gravel: new Asset('gravel', 'audio', { url: './assets/sounds/footsteps.mp3' }),
    hdri: new Asset('hdri', 'texture', { url: './assets/hdri/wide-street.hdr' }, { mipmaps: false })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES
});
camera.addComponent('audiolistener');
camera.rotateLocal(-30, 0, 0);
camera.translateLocal(0, 0, 5);
app.root.addChild(camera);

// Use the HDRI for the skybox, and for the ambient lighting, so the side of the character facing
// away from the sun is not black
const applyHdri = (/** @type {Texture} */ source) => {
    app.scene.skybox = EnvLighting.generateSkyboxCubemap(source);
    const lighting = EnvLighting.generateLightingSource(source);
    app.scene.envAtlas = EnvLighting.generateAtlas(lighting);
    lighting.destroy();
};
applyHdri(assets.hdri.resource);

// When the device is lost, the skybox textures need to be regenerated from the HDRI
device.on('devicerestored', () => {
    applyHdri(assets.hdri.resource);
});

// Project the skybox onto a dome, so the character runs on the street
app.scene.exposure = 0.7;
app.scene.sky.type = SKYTYPE_DOME;
app.scene.sky.node.setLocalScale(new Vec3(30, 30, 30));
app.scene.sky.center = new Vec3(0, 0.05, 0);

// Catch the shadows on the ground of the dome
const shadowCatcher = new Entity('shadow-catcher');
shadowCatcher.addComponent('script').create(ShadowCatcher, {
    properties: {
        scale: new Vec3(20, 20, 20)
    }
});
shadowCatcher.setLocalPosition(0, 0.01, 0);
app.root.addChild(shadowCatcher);

// Create an entity with a light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.95, 0.85),
    castShadows: true,
    intensity: 1.5,
    shadowBias: 0.1,
    normalOffsetBias: 0.1,
    shadowDistance: 16,
    shadowResolution: 2048,
    shadowType: SHADOW_PCSS_32F,
    penumbraSize: 0.05,
    penumbraFalloff: 4,
    shadowSamples: 16,
    shadowBlockerSamples: 16
});
app.root.addChild(light);

// Low sun: an elevation of atan(1/3) makes shadows three times as long as the caster is tall
const sunPitch = 90 - Math.atan(1 / 3) * math.RAD_TO_DEG;

app.start();

// Create running character
const entity = assets.model.resource.instantiateRenderEntity({
    castShadows: true
});

// Add sound component
entity.addComponent('sound', {
    maxDistance: 9
});

// Add footsteps slot
entity.sound.addSlot('footsteps', {
    asset: assets.gravel.id,
    pitch: 1.7,
    loop: true,
    autoPlay: true
});

// Add run animation
entity.addComponent('anim', {
    activate: true
});
entity.anim.assignAnimation('Run', assets.runAnim.resource.animations[0].resource, undefined, 0.8);

// Add entity in the hierarchy
app.root.addChild(entity);

let angle = 135;
const radius = 3;
const height = 0; // 1.1;
app.on('update', (dt) => {
    angle += 30 * dt;
    if (angle > 360) {
        angle -= 360;
    }
    entity.setLocalPosition(
        radius * Math.sin(angle * math.DEG_TO_RAD),
        height,
        radius * Math.cos(angle * math.DEG_TO_RAD)
    );
    entity.setLocalEulerAngles(0, angle + 90, 0);

    // Turn the sun to follow the character, so its shadow points to the center of the circle and
    // stays visible even when the character is off screen
    light.setLocalEulerAngles(sunPitch, angle, 0);
});
