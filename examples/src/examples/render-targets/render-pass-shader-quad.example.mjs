// @config
//
// Paints glowing light trails into a texture using two `RenderPassShaderQuad` passes, which are
// not attached to any camera. Each frame, a fade pass darkens what the texture already contains,
// using a reverse subtract blend state, and a brush pass then adds a soft dot along the path of
// each brush, setting the viewport of each dot to a small rectangle around it, and optionally a
// scissor rectangle keeping a border clear. The texture is only cleared when **Clear** is pressed,
// and is used as the emissive map of the cube.

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLENDEQUATION_ADD,
    BLENDEQUATION_MAX,
    BLENDEQUATION_REVERSE_SUBTRACT,
    BLENDMODE_ONE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BlendState,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    Mouse,
    PIXELFORMAT_RGBA16F,
    PIXELFORMAT_SRGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderPassShaderQuad,
    RenderTarget,
    SEMANTIC_POSITION,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderUtils,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    Texture,
    TextureHandler,
    TextureRenderer,
    TouchDevice,
    Vec3,
    Vec4,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

import brushGlslFrag from './brush.glsl.frag';
import brushWgslFrag from './brush.wgsl.frag';
import fadeGlslFrag from './fade.glsl.frag';
import fadeWgslFrag from './fade.wgsl.frag';

/**
 * @import { GraphicsDevice } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// A pass rendering a quad covering the whole canvas, which fades what the canvas contains. The
// RenderPassShaderQuad renders the quad using its shader, with its blend state.
class RenderPassFade extends RenderPassShaderQuad {
    /** The fraction of the light removed, and the constant amount removed. */
    fade = new Float32Array(4);

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'FadeShader',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentGLSL: fadeGlslFrag,
            fragmentWGSL: fadeWgslFrag
        });

        // canvas = canvas * (1 - fade.a) - fade.rgb
        this.blendState = new BlendState(
            true,
            BLENDEQUATION_REVERSE_SUBTRACT,
            BLENDMODE_ONE,
            BLENDMODE_ONE_MINUS_SRC_ALPHA
        );

        this.fadeId = device.scope.resolve('uFade');
    }

    execute() {
        this.fadeId.setValue(this.fade);
        super.execute();
    }
}

// A pass rendering a soft dot for each stamp, all within a single GPU render pass. Each dot is a
// quad rendered to the viewport set around it.
class RenderPassBrush extends RenderPassShaderQuad {
    /**
     * The dots to render this frame, each with the viewport rectangle in pixels, and its color.
     *
     * @type {{ rect: Vec4, color: Float32Array }[]}
     */
    stamps = [];

    /** The number of the stamps to render this frame. */
    stampCount = 0;

    /** The brightness of a single dot. */
    intensity = 1;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'BrushShader',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentGLSL: brushGlslFrag,
            fragmentWGSL: brushWgslFrag
        });

        const scope = device.scope;
        this.colorId = scope.resolve('uBrushColor');
        this.intensityId = scope.resolve('uBrushIntensity');
    }

    // a stamp from the pool, to fill in
    addStamp() {
        if (this.stampCount === this.stamps.length) {
            this.stamps.push({ rect: new Vec4(), color: new Float32Array(3) });
        }
        return this.stamps[this.stampCount++];
    }

    execute() {
        this.intensityId.setValue(this.intensity);

        // render a quad for each stamp, by setting its viewport and color, and letting the
        // RenderPassShaderQuad render the quad
        for (let i = 0; i < this.stampCount; i++) {
            const stamp = this.stamps[i];
            this.colorId.setValue(stamp.color);
            this.viewport = stamp.rect;
            super.execute();
        }
        this.stampCount = 0;
    }
}

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    studio: new Asset(
        'studio-env-atlas',
        'texture',
        { url: './assets/cubemaps/studio-env-atlas.png' },
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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

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

data.set('settings', {
    count: 5,
    size: 28,
    speed: 1,
    blend: 'add',
    trail: 1.5,
    border: false
});

// a photo studio environment the cube reflects, with a blurred skybox
app.scene.envAtlas = assets.studio.resource;
app.scene.skyboxMip = 2;

// ------ The canvas the trails are painted into ------

const CANVAS_SIZE = 1024;

// A half float format stores the small changes of the slowly fading trails, which an 8-bit format
// would round away, and the light of overlapping trails brighter than 1. Without it, an sRGB format
// keeps the most precision in the darks.
const canvasTexture = new Texture(device, {
    name: 'TrailsCanvas',
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    format: device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F : PIXELFORMAT_SRGBA8,
    mipmaps: true,
    minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE,
    anisotropy: 8
});

const canvasTarget = new RenderTarget({
    name: 'TrailsCanvas',
    colorBuffer: canvasTexture,
    depth: false
});

// ------ The render passes ------

// The fade pass renders over what the canvas contains, which it loads, as it does not clear the
// canvas by default. Both passes render to the canvas, and its mipmaps are only needed after the
// brush pass, which renders last.
const fadePass = new RenderPassFade(device);
fadePass.init(canvasTarget);
fadePass.colorOps.genMipmaps = false;

// the canvas is cleared when the fade pass renders for the first time
fadePass.setClearColor(Color.BLACK);

const brushPass = new RenderPassBrush(device);
brushPass.init(canvasTarget);

// the blend states the brushes paint with, for the premultiplied colors of the brush shader
const blendStates = {
    // adds the light
    add: BlendState.ADDBLEND,
    // paints over the trails
    normal: new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC_ALPHA),
    // keeps the brighter of the trails and the dot
    lighten: new BlendState(true, BLENDEQUATION_MAX, BLENDMODE_ONE, BLENDMODE_ONE)
};

// when enabled, the scissor rectangle keeps the brushes from painting a border around the canvas
const border = CANVAS_SIZE * 0.1;
const scissor = new Vec4(border, border, CANVAS_SIZE - 2 * border, CANVAS_SIZE - 2 * border);

app.on('destroy', () => {
    fadePass.destroy();
    brushPass.destroy();
    canvasTarget.destroyTextureBuffers();
    canvasTarget.destroy();
});

data.on('clear', () => {
    fadePass.setClearColor(Color.BLACK);
});

// ------ The scene ------

// A dark, partly metallic cube with a polished surface, reflecting the studio on all its faces,
// using the canvas as its emissive map, which shows the trails unchanged
const material = new StandardMaterial();
material.diffuse = new Color(0.3, 0.31, 0.34);
material.useMetalness = true;
material.metalness = 0.6;
material.gloss = 0.92;
material.emissiveMap = canvasTexture;
material.emissive = Color.WHITE;
material.update();

const cube = new Entity('Cube');
cube.addComponent('render', {
    type: 'box',
    material
});
cube.setLocalScale(1.6, 1.6, 1.6);
app.root.addChild(cube);

// The camera, orbiting the cube. The neutral tone mapping keeps the saturated colors of the
// trails, which ACES would shift in hue and bleach where they are bright.
const camera = new Entity('Camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_NEUTRAL,
    farClip: 100
});
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMin: 2.5,
        distanceMax: 12
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);
camera.script.orbitCamera.resetAndLookAtPoint(new Vec3(0.85, 1.25, 5.08), Vec3.ZERO);

// ------ The brushes ------

const MAX_BRUSHES = 8;

// each brush moves along its own Lissajous curve, remembering where it was in the previous frame
const brushes = Array.from({ length: MAX_BRUSHES }, (_, index) => ({
    frequencyX: 0.31 + 0.13 * index,
    frequencyY: 0.47 + 0.07 * ((index * 5) % 8),
    phaseX: index * 1.7,
    phaseY: index * 2.9,
    x: 0,
    y: 0,
    started: false
}));

// a fully saturated color of the hue, in the 0 .. 1 range
const hueToColor = (/** @type {number} */ hue, /** @type {Float32Array} */ out) => {
    const h = hue * 6;
    out[0] = math.clamp(Math.abs(h - 3) - 1, 0, 1);
    out[1] = math.clamp(2 - Math.abs(h - 2), 0, 1);
    out[2] = math.clamp(2 - Math.abs(h - 4), 0, 1);
};

let time = 0;

// adds the dots of each brush along its path since the previous frame, so that the trails stay
// continuous at any speed
const addStamps = () => {
    const settings = data.get('settings');
    const radius = settings.size;
    const spacing = radius * 0.25;
    const amplitude = (CANVAS_SIZE - 2 * radius) * 0.5 * 0.9;

    for (let i = 0; i < settings.count; i++) {
        const brush = brushes[i];
        const x = CANVAS_SIZE * 0.5 + amplitude * Math.sin(brush.frequencyX * time + brush.phaseX);
        const y = CANVAS_SIZE * 0.5 + amplitude * Math.sin(brush.frequencyY * time + brush.phaseY);

        // a brush starting this frame paints a single dot
        if (!brush.started) {
            brush.started = true;
            brush.x = x;
            brush.y = y;
        }

        const steps = Math.max(1, Math.ceil(Math.hypot(x - brush.x, y - brush.y) / spacing));
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const cx = math.lerp(brush.x, x, t);
            const cy = math.lerp(brush.y, y, t);

            // the viewport is kept within the canvas
            const stamp = brushPass.addStamp();
            stamp.rect.set(
                math.clamp(cx - radius, 0, CANVAS_SIZE - 2 * radius),
                math.clamp(cy - radius, 0, CANVAS_SIZE - 2 * radius),
                2 * radius,
                2 * radius
            );
            hueToColor((i / settings.count + time * 0.05) % 1, stamp.color);
        }

        brush.x = x;
        brush.y = y;
    }

    // the brushes which are not used start again from their position when used
    for (let i = settings.count; i < MAX_BRUSHES; i++) {
        brushes[i].started = false;
    }
};

// shows the canvas in a corner of the screen
const textureRenderer = new TextureRenderer(app);

app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');
    time += dt * settings.speed;

    // fade the trails at the same rate at any frame rate: a fraction of the light, and a small
    // constant amount which removes the remains of the trails
    const fade = fadePass.fade;
    fade[3] = 1 - Math.exp(-dt / settings.trail);
    fade[0] = fade[1] = fade[2] = (0.02 * dt) / settings.trail;

    // the brushes, painting with the selected blend state. Overlapping dots add up when adding
    // the light, and so each is dimmer
    addStamps();
    brushPass.blendState = blendStates[settings.blend];
    brushPass.intensity = settings.blend === 'add' ? 0.25 : 1;
    brushPass.scissor = settings.border ? scissor : undefined;

    cube.rotate(4 * dt, 9 * dt, 0);

    // a square preview of the canvas at the bottom right corner
    const { width, height } = device;
    const side = 0.25 * Math.min(width, height);
    const margin = 0.08 * side;
    textureRenderer.draw(
        canvasTexture,
        1 - (side + margin) / width,
        1 - (side + margin) / height,
        side / width,
        side / height
    );
});

// Paint the canvas before the cameras render the scene, which uses it. The fade pass renders
// first, then the brushes paint over it. The passes render from 'prerender' rather than 'update',
// as it only fires when a frame is rendered, and runs as part of that frame, which is where the
// GPU profiler reports them.
app.on('prerender', () => {
    fadePass.render();
    brushPass.render();

    // the clear happens only once, the passes keep what the canvas contains from now on
    fadePass.setClearColor(undefined);
});

export { app };
