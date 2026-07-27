// @config
//
// This example shows how a custom shader created using {accent:ShaderMaterial} can cast shadows,
// including shadows of skinned, morphed and alpha-tested meshes, for all supported shadow types.
//
// @credit
// title: MorphStressTest
// author: Ed Mackey
// source: https://github.com/KhronosGroup/glTF-Sample-Models/blob/master/2.0/MorphStressTest/README.md
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Cross-hatching textures
// author: Jaume Sanchez (spite)
// source: https://github.com/spite/cross-hatching
// license: MIT

import {
    ADDRESS_REPEAT,
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    Keyboard,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_VSM_32F,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    Texture,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { createHatchMaterial } from 'examples/assets/scripts/misc/hatch-material.mjs';
import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),

    bitmoji: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    danceAnim: new Asset('danceAnim', 'container', { url: './assets/animations/bitmoji/win-dance.glb' }),
    morph: new Asset('glb', 'container', { url: './assets/models/morph-stress-test.glb' }),

    // Hatch textures, sorted from light to dark
    hatch0: new Asset('hatch0', 'texture', { url: './assets/textures/hatch-0.jpg' }, { srgb: true }),
    hatch1: new Asset('hatch1', 'texture', { url: './assets/textures/hatch-1.jpg' }, { srgb: true }),
    hatch2: new Asset('hatch2', 'texture', { url: './assets/textures/hatch-2.jpg' }, { srgb: true }),
    hatch3: new Asset('hatch3', 'texture', { url: './assets/textures/hatch-3.jpg' }, { srgb: true }),
    hatch4: new Asset('hatch4', 'texture', { url: './assets/textures/hatch-4.jpg' }, { srgb: true }),
    hatch5: new Asset('hatch5', 'texture', { url: './assets/textures/hatch-5.jpg' }, { srgb: true })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const createOptions = new AppOptions();
createOptions.graphicsDevice = await createGraphicsDevice(canvas, gfxOptions);
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(document.body);

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

// A helper function to apply a material to all mesh instances of an entity
const applyMaterial = (entity, material) => {
    entity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((meshInstance) => {
            meshInstance.material = material;
        });
    });
};

// Create a new material with a hatch shader. Internally a texture array is created from the hatch
// textures, as well as a custom shader that is used to render the hatch pattern, which also
// supports shadow casting.
const material = createHatchMaterial(app.graphicsDevice, [
    assets.hatch0.resource,
    assets.hatch1.resource,
    assets.hatch2.resource,
    assets.hatch3.resource,
    assets.hatch4.resource,
    assets.hatch5.resource
]);
material.setParameter('uDensity', 10);
material.setParameter('uColor', [1.0, 0.65, 0.0]);

// Store all hatch materials to allow for easy modification
const materials = [material];

// Animated bitmoji model, which uses skinning, casting shadow
const bitmojiEntity = assets.bitmoji.resource.instantiateRenderEntity({
    castShadows: true
});
bitmojiEntity.setLocalScale(25, 25, 25);
app.root.addChild(bitmojiEntity);
applyMaterial(bitmojiEntity, material);

// Play the dance animation
bitmojiEntity.addComponent('anim', { activate: true });
const danceTrack = assets.danceAnim.resource.animations[0].resource;
bitmojiEntity.anim.assignAnimation('Dance', danceTrack, undefined, 0.62);

// Create an instance of the morph target model with a clone of the hatch material, and play
// a morphing animation on it
const morphMaterial = material.clone();
morphMaterial.setParameter('uColor', [1, 0.21, 0.4]);
materials.push(morphMaterial);
const morphEntity = assets.morph.resource.instantiateRenderEntity({
    castShadows: true
});
app.root.addChild(morphEntity);
morphEntity.setLocalScale(12, 12, 12);
morphEntity.setLocalPosition(0, 1.2, -18);
morphEntity.addComponent('anim', { activate: true });
const morphAnimation = assets.morph.resource.animations[1].resource;
morphEntity.anim.assignAnimation('Default', morphAnimation, undefined, 0.62);
applyMaterial(morphEntity, morphMaterial);

// Create a checkerboard texture, with alpha channel being 0 or 1 for the individual squares. This
// is used by the sphere material to discard fragments, to demonstrate shadows of a material with
// transparent areas.
const checkerSize = 16;
const checkerData = new Uint8Array(checkerSize * checkerSize * 4);
for (let y = 0; y < checkerSize; y++) {
    for (let x = 0; x < checkerSize; x++) {
        const offset = (y * checkerSize + x) * 4;
        const alpha = (x + y) % 2 === 0 ? 255 : 0;
        checkerData.set([255, 255, 255, alpha], offset);
    }
}
const checkerTexture = new Texture(app.graphicsDevice, {
    name: 'CheckerboardAlpha',
    format: PIXELFORMAT_RGBA8,
    width: checkerSize,
    height: checkerSize,
    magFilter: FILTER_NEAREST,
    minFilter: FILTER_NEAREST,
    mipmaps: false,
    addressU: ADDRESS_REPEAT,
    addressV: ADDRESS_REPEAT,
    levels: [checkerData]
});

// Create a static sphere with a clone of the hatch material, set up to discard fragments based
// on the alpha channel of the checkerboard texture
const sphereMaterial = material.clone();
sphereMaterial.setParameter('uColor', [0.53, 0.81, 0.92]);
sphereMaterial.setDefine('CUTOUT', true);
sphereMaterial.setParameter('uCutoutMap', checkerTexture);
sphereMaterial.update();
materials.push(sphereMaterial);

const sphere = new Entity('Sphere');
sphere.addComponent('render', {
    type: 'sphere',
    material: sphereMaterial,
    castShadows: true
});
sphere.setLocalScale(16, 16, 16);
sphere.setLocalPosition(16, 8, -4);
app.root.addChild(sphere);

// Create a ground plane using StandardMaterial, which receives shadows cast by the custom shader
// materials
const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.7, 0.7, 0.7);
groundMaterial.gloss = 0.2;
groundMaterial.update();

const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'box',
    material: groundMaterial,
    castShadows: false
});
ground.setLocalScale(120, 1, 120);
ground.setLocalPosition(0, -0.5, 0);
app.root.addChild(ground);

// Add a shadow casting directional light
const light = new Entity('Light');
light.addComponent('light', {
    type: 'directional',
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.06,
    shadowDistance: 150,
    shadowResolution: 2048,
    vsmBlurSize: 16,
    penumbraSize: 0.05,
    penumbraFalloff: 4,
    intensity: 1.5
});
app.root.addChild(light);

// rotate the light so that the shadows are cast towards the default camera position
light.setLocalEulerAngles(-45, 45, 0);

// The custom shader uses a light direction uniform for its stylized shading - set it to match
// the direction of the shadow casting light, so the shading and the shadows are consistent.
// Directional lights emit along their negative Y axis, so the direction to the light is its up vector.
const lightDir = light.up;
materials.forEach((mat) => {
    mat.setParameter('uLightDir', [lightDir.x, lightDir.y, lightDir.z]);
    mat.update();
});

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5)
});
// TEMPORARY: artifact repro view
camera.setLocalPosition(4.86, 52.59, 13.26);
camera.setLocalEulerAngles(-77.76, 5.54, 0);

// Add orbit camera script to the camera
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: bitmojiEntity,
        distanceMax: 100
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// TEMPORARY: debug helpers for finding VSM artifact repro poses.
// Collect the animated entities, and allow the animation to be paused / scrubbed.
const animEntities = [bitmojiEntity, morphEntity];

// Set the animation of all animated entities to the given time, and refresh their pose
const setAnimTime = (time) => {
    animEntities.forEach((entity) => {
        const layer = entity.anim.baseLayer;
        const wasPlaying = entity.anim.playing;
        entity.anim.playing = true;
        layer.activeStateCurrentTime = time % layer.activeStateDuration;
        entity.anim.update(0);
        entity.anim.playing = wasPlaying;
    });
};

// TEMPORARY: log the animation time and camera orientation once a second
let logTimer = 0;
app.on('update', (dt) => {
    // keep the scrubber in sync with the playing animation
    if (!data.get('settings.paused')) {
        data.set('settings.animTime', +bitmojiEntity.anim.baseLayer.activeStateCurrentTime.toFixed(3));
    }

    logTimer += dt;
    if (logTimer > 1) {
        logTimer = 0;
        const t = bitmojiEntity.anim.baseLayer.activeStateCurrentTime;
        const p = camera.getPosition();
        const e = camera.getEulerAngles();
        console.log(`animTime: ${t} camera pos: (${p.x}, ${p.y}, ${p.z}) euler: (${e.x}, ${e.y}, ${e.z})`);
    }
});

// Handle UI changes
data.on('*:set', (path, value) => {
    if (path === 'settings.shadowType') {
        light.light.shadowType = value;
    }
    if (path === 'settings.paused') {
        // pause / resume the animation playback
        animEntities.forEach((entity) => {
            entity.anim.playing = !value;
        });
    }
    if (path === 'settings.animTime' && data.get('settings.paused')) {
        // scrubbing is only applied while paused
        setAnimTime(value);
    }
});

// Initial values
// TEMPORARY: start paused at the artifact repro pose, using VSM_32F
const reproTime = 1.12;
data.set('settings', {
    shadowType: SHADOW_VSM_32F,
    paused: true,
    animTime: reproTime
});

// apply the initial paused state and pose (the bulk data.set above does not fire per-property events)
light.light.shadowType = SHADOW_VSM_32F;
animEntities.forEach((entity) => {
    entity.anim.playing = false;
});
setAnimTime(reproTime);
