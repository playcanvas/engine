// @config
//
// This example shows how to add a custom post-effect to a CameraFrame with CameraFrameEffect. A
// pixelation effect is written as a shader chunk whose entry function the single compose pass calls,
// so no additional full-screen pass is needed. The effect is an instance registered with one
// CameraFrame, and its parameters are applied by cameraFrame.update(), like those of the built-in
// effects.
//
// @credit
// title: Mirror's Edge Apartment - Interior Scene
// author: Aurélien Martel
// source: https://sketchfab.com/3d-models/mirrors-edge-apartment-interior-scene-9804e9f2fe284070b081c96ceaf8af96
// license: CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/)
//
// @credit
// title: Love neon sign 02
// author: daysena
// source: https://sketchfab.com/3d-models/love-neon-sign-02-9add8bfcb25943d0aae87e0af07c8e4d
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    COMPOSESLOT_LDR,
    CameraComponentSystem,
    CameraFrame,
    CameraFrameEffect,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    apartment: new Asset('apartment', 'container', { url: './assets/models/apartment.glb' }),
    love: new Asset('love', 'container', { url: './assets/models/love.glb' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
    // to avoid the additional cost. This is only used for the UI which renders on top of the
    // post-processed scene, and we're typically happy with some aliasing on the UI.
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(window);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

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

// Setup skydome with low intensity
app.scene.envAtlas = assets.helipad.resource;
app.scene.exposure = 1.2;

// Create an instance of the apartment and add it to the scene
const platformEntity = assets.apartment.resource.instantiateRenderEntity();
platformEntity.setLocalScale(30, 30, 30);
app.root.addChild(platformEntity);

// Load a love sign model and add it to the scene
const loveEntity = assets.love.resource.instantiateRenderEntity();
loveEntity.setLocalPosition(-80, 30, -20);
loveEntity.setLocalScale(130, 130, 130);
loveEntity.rotate(0, -90, 0);
app.root.addChild(loveEntity);

// Make the love sign emissive to bloom
const loveMaterial = loveEntity.findByName('s.0009_Standard_FF00BB_0').render.meshInstances[0].material;
loveMaterial.emissive = Color.YELLOW;
loveMaterial.emissiveIntensity = 200;
loveMaterial.update();

// Adjust all materials of the love sign to disable dynamic refraction
loveEntity.findComponents('render').forEach((render) => {
    render.meshInstances.forEach((meshInstance) => {
        meshInstance.material.useDynamicRefraction = false;
    });
});

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    farClip: 1500,
    fov: 80
});

const focusPoint = new Entity();
focusPoint.setLocalPosition(-80, 80, -20);

// Add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: focusPoint,
        distanceMax: 500,
        frameOnStart: false
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

cameraEntity.setLocalPosition(-50, 100, 220);
cameraEntity.lookAt(0, 0, 100);
app.root.addChild(cameraEntity);

// ------ Custom compose effect ------

// Pixelation shader is based on this shadertoy shader: https://www.shadertoy.com/view/4dsXWs

// A CameraFrameEffect contributes a shader chunk to the compose pass. The chunk declares its uniforms
// and an entry function named apply<Id>, which the compose shader calls for the effect's slot as
// `result = applyPixelation(result, uv)`. COMPOSESLOT_LDR runs after tone mapping, so the dots are
// drawn in display space. update() hands the uniform values to the effect when cameraFrame.update() is called.
class PixelationEffect extends CameraFrameEffect {
    // Size of one pixelation tile in screen pixels
    tilePixels = 8;

    // Blend between the original image (0) and the pixelated result (1)
    intensity = 0.5;

    constructor(device) {
        super(device, 'pixelation', {
            slot: COMPOSESLOT_LDR,
            glsl: /* glsl */ `
                uniform float pixelationTilePixels;
                uniform float pixelationIntensity;

                vec3 applyPixelation(vec3 color, vec2 uv) {
                    vec2 tileUV = vec2(pixelationTilePixels) * sceneTextureSize.zw;
                    vec2 centerUv = (floor(uv / tileUV) + 0.5) * tileUV;

                    vec2 local = (uv - centerUv) / tileUV;
                    float dist = length(local);
                    float radius = 0.35;
                    float edge = fwidth(dist) * 1.5;
                    float mask = 1.0 - smoothstep(radius, radius + edge, dist);
                    vec3 dotResult = mix(vec3(0.0), color, mask);
                    return mix(color, dotResult, pixelationIntensity);
                }
            `,
            wgsl: /* wgsl */ `
                uniform pixelationTilePixels: f32;
                uniform pixelationIntensity: f32;

                fn applyPixelation(color: vec3f, uv: vec2f) -> vec3f {
                    let tileUV = vec2f(uniform.pixelationTilePixels) * uniform.sceneTextureSize.zw;
                    let centerUv = (floor(uv / tileUV) + vec2f(0.5, 0.5)) * tileUV;

                    let local = (uv - centerUv) / tileUV;
                    let dist = length(local);
                    let radius: f32 = 0.35;
                    let edge: f32 = fwidth(dist) * 1.5;
                    let mask: f32 = 1.0 - smoothstep(radius, radius + edge, dist);
                    let dotResult = color * mask;
                    return mix(color, dotResult, uniform.pixelationIntensity);
                }
            `
        });
    }

    // At zero intensity the effect would leave the image untouched, so it is left out of the shader
    get active() {
        return this.enabled && this.intensity > 0;
    }

    // called by cameraFrame.update(), the values apply to the frames rendered after it
    update() {
        this.setUniform('pixelationTilePixels', this.tilePixels);
        this.setUniform('pixelationIntensity', this.intensity);
    }
}

// ------ Custom render passes set up ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.samples = 4;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 7;
cameraFrame.vignette.inner = 0.5;
cameraFrame.vignette.outer = 1;
cameraFrame.vignette.curvature = 0.5;
cameraFrame.vignette.intensity = 0.8;

// Register the effect with this camera frame. Effects sharing a slot run in registration order, so
// the pixelation is applied after the built-in vignette.
const pixelation = new PixelationEffect(device);
cameraFrame.addEffect(pixelation);

cameraFrame.update();

// Apply UI changes, applied by cameraFrame.update()
data.on('*:set', (/** @type {string} */ path, value) => {
    if (path === 'data.sceneTonemapping') {
        // postprocessing tone mapping
        cameraFrame.rendering.toneMapping = value;
        cameraFrame.update();
    }

    if (path === 'data.pixelSize') {
        pixelation.tilePixels = value;
        cameraFrame.update();
    }

    if (path === 'data.pixelationIntensity') {
        pixelation.intensity = value;
        cameraFrame.update();
    }
});

// Set initial values
data.set('data', {
    sceneTonemapping: TONEMAP_NEUTRAL,
    pixelSize: 8,
    pixelationIntensity: 0.5
});
