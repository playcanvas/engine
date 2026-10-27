// @config
//
// This example shows how to write a CameraFrameEffect with its own render pass. An ink outline
// effect draws lines where the depth or the brightness of the opaque scene changes abruptly. Its pass
// runs after the opaque geometry and before the transparent geometry, reading a copy of the opaque
// scene the camera frame takes for it, and drawing the lines into the scene. The bubbles and the
// fireflies are transparent, so they render after it, and are not outlined.
//
// @credit
// title: House Scene
// author: Sketchfab
// source: https://sketchfab.com/3d-models/house-scene-52772448c62348e0a4951b51758d5587
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_ADDITIVE,
    BLEND_NORMAL,
    CameraComponentSystem,
    CameraFrame,
    CameraFrameEffect,
    Color,
    ContainerHandler,
    Curve,
    CurveSet,
    Entity,
    FILLMODE_FILL_WINDOW,
    FRAMERESOURCE_DEPTH,
    FRAMERESOURCE_SCENECOLORGRAB,
    FRAMERESOURCE_SCENETARGET,
    Keyboard,
    LightComponentSystem,
    Mouse,
    PROJECTION_ORTHOGRAPHIC,
    ParticleSystemComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderPassShaderQuad,
    SEMANTIC_POSITION,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderUtils,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    house: new Asset('house', 'container', { url: './assets/models/house.glb' }),
    spark: new Asset('spark', 'texture', { url: './assets/textures/spark.png' }, { srgb: true }),
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
    // to avoid the additional cost.
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
    ParticleSystemComponentSystem,
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

// The sky and the image based lighting
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 1.4;

// ------ The scene ------

// The house, a white model which the outlines turn into a drawing
const house = assets.house.resource.instantiateRenderEntity();
house.setLocalScale(100, 100, 100);
app.root.addChild(house);

// A warm directional light casting shadows, whose outlines are drawn as well
const light = new Entity('Light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.92, 0.8),
    intensity: 2,
    castShadows: true,
    shadowDistance: 80,
    shadowResolution: 2048,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
light.setLocalEulerAngles(-55, 0, -30);
app.root.addChild(light);

// A pseudo random number generator, so that the scene is the same on every run
let seed = 3;
const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};

// Soap bubbles rising around the house, each tinted a little differently. They are transparent, so
// they render after the outlines.
const bubbleTints = [
    new Color(1, 0.7, 0.85),
    new Color(0.7, 0.85, 1),
    new Color(0.75, 1, 0.8),
    new Color(1, 0.95, 0.7)
];
const bubbles = [];
for (let i = 0; i < 20; i++) {
    const material = new StandardMaterial();
    material.diffuse = bubbleTints[i % bubbleTints.length];
    material.opacity = 0.3;
    material.blendType = BLEND_NORMAL;
    material.useMetalness = true;
    material.metalness = 0;
    material.gloss = 0.95;
    material.opacityFadesSpecular = false;
    material.useIridescence = true;
    material.iridescence = 1;
    material.iridescenceRefractionIndex = 1.33;
    material.iridescenceThicknessMin = 300;
    material.iridescenceThicknessMax = 600 + random() * 400;
    material.depthWrite = false;
    material.update();

    const bubble = new Entity('Bubble');
    bubble.addComponent('render', { type: 'sphere', material, castShadows: false });
    const size = 2 + random() * 3.6;
    bubble.setLocalScale(size, size, size);
    app.root.addChild(bubble);
    bubbles.push({
        entity: bubble,
        angle: random() * Math.PI * 2,
        distance: 5 + random() * 12,
        height: random() * 20,
        speed: 0.8 + random() * 1.2
    });
}

// Fireflies drifting around the house, transparent as well
const fireflies = new Entity('Fireflies');
fireflies.setLocalPosition(0, 6, 0);
fireflies.addComponent('particlesystem', {
    numParticles: 120,
    lifetime: 5,
    rate: 0.04,
    emitterExtents: new Vec3(30, 10, 30),
    blendType: BLEND_ADDITIVE,
    colorMap: assets.spark.resource,
    intensity: 6,
    scaleGraph: new Curve([0, 1, 0.5, 1.6, 1, 1]),
    colorGraph: new CurveSet([
        [0, 0, 0.2, 1, 0.8, 1, 1, 0],
        [0, 0, 0.2, 0.85, 0.8, 0.85, 1, 0],
        [0, 0, 0.2, 0.3, 0.8, 0.3, 1, 0]
    ]),
    localVelocityGraph: new CurveSet([
        [0, -1],
        [0, -0.5],
        [0, -1]
    ]),
    localVelocityGraph2: new CurveSet([
        [0, 1],
        [0, 1],
        [0, 1]
    ])
});
app.root.addChild(fireflies);

// ------ The camera ------

const cameraEntity = new Entity('Camera');
cameraEntity.addComponent('camera', {
    farClip: 500,
    fov: 50
});

// Add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: house,
        distanceMax: 120,
        frameOnStart: false
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

cameraEntity.setLocalPosition(28, 14, 28);
app.root.addChild(cameraEntity);

// ------ The ink outline effect ------

// A full screen pass drawing ink lines where the depth or the brightness of the opaque scene changes
// abruptly. It reads the copy of the opaque scene, published to the uSceneColorMap texture before it
// runs, and the scene depth, and draws the lines into the scene. Pixels without a line are
// discarded, so they stay as they were.
class RenderPassInkOutline extends RenderPassShaderQuad {
    // the width of the lines, in whole pixels
    width = 1;

    // how sensitive the lines are to changes of the depth, and of the brightness
    depthThreshold = 0;

    colorThreshold = 0;

    // how dark the lines are, 0-1
    intensity = 1;

    color = new Color();

    // the size of a pixel of the scene, in uv space
    texelWidth = 0;

    texelHeight = 0;

    /**
     * @param {import('playcanvas').GraphicsDevice} device - The graphics device.
     * @param {import('playcanvas').CameraComponent} cameraComponent - The camera.
     * @param {{ defines: Map<string, string>, key: string }} depth - The scene depth, with the
     * defines describing how it is stored, which the shader reading it needs.
     */
    constructor(device, cameraComponent, depth) {
        super(device);
        this.cameraComponent = cameraComponent;

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `InkOutlineShader-${depth.key}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentDefines: depth.defines,

            fragmentGLSL: /* glsl */ `
                #include "screenDepthPS"

                uniform sampler2D uSceneColorMap;
                uniform vec4 inkParams;
                uniform vec3 inkColor;
                uniform vec2 inkTexelSize;
                varying vec2 uv0;

                float inverseDepth(vec2 uv) {
                    return 1.0 / getLinearScreenDepth(uv);
                }

                float luminance(vec2 uv) {
                    return dot(texture2DLod(uSceneColorMap, uv, 0.0).rgb, vec3(0.2126, 0.7152, 0.0722));
                }

                float contrast(float a, float b) {
                    return abs(a - b) / (a + b + 0.05);
                }

                // the center of the texel a position is in
                vec2 snapToTexel(vec2 uv) {
                    return (floor(uv / inkTexelSize) + 0.5) * inkTexelSize;
                }

                // the ink at a texel center, comparing the samples a and b away on both diagonals
                float inkAt(vec2 uv, vec2 a, vec2 b) {

                    // The inverse of the depth changes linearly across a flat surface, so its second
                    // difference is zero there, and lines appear at silhouettes and creases only.
                    // Relative to the depth, it does not depend on the distance.
                    float center = inverseDepth(uv);
                    float depthEdge = (abs(inverseDepth(uv + a) + inverseDepth(uv - a) - 2.0 * center) +
                                       abs(inverseDepth(uv + b) + inverseDepth(uv - b) - 2.0 * center)) / center;

                    // abrupt changes of the brightness, such as the outlines of the shadows
                    float colorEdge = max(contrast(luminance(uv + a), luminance(uv - a)),
                                          contrast(luminance(uv + b), luminance(uv - b)));

                    return max(smoothstep(inkParams.y, inkParams.y * 2.0, depthEdge),
                               smoothstep(inkParams.z, inkParams.z * 2.0, colorEdge));
                }

                void main() {

                    // The depth is read from the nearest texel, so the samples compared are a whole
                    // number of texels away from a texel center - on a flat surface they are then the
                    // same distance away on both sides, and their second difference stays zero.
                    vec2 a = inkTexelSize * inkParams.x;
                    vec2 b = vec2(a.x, -a.y);

                    // The ink averaged over four positions spread across the pixel in a rotated grid,
                    // scaled with the width of the lines. The lines then fade out over a pixel or more
                    // at their edges, instead of stepping between the pixels.
                    float ink = (inkAt(snapToTexel(uv0 + a * vec2(-0.375, -0.125)), a, b) +
                                 inkAt(snapToTexel(uv0 + a * vec2(0.125, -0.375)), a, b) +
                                 inkAt(snapToTexel(uv0 + a * vec2(0.375, 0.125)), a, b) +
                                 inkAt(snapToTexel(uv0 + a * vec2(-0.125, 0.375)), a, b)) * 0.25 * inkParams.w;
                    if (ink <= 0.0) {
                        discard;
                    }

                    vec4 scene = texture2DLod(uSceneColorMap, uv0, 0.0);
                    gl_FragColor = vec4(mix(scene.rgb, inkColor, ink), scene.a);
                }
            `,

            fragmentWGSL: /* wgsl */ `
                #include "screenDepthPS"

                var uSceneColorMap: texture_2d<f32>;
                var uSceneColorMapSampler: sampler;
                uniform inkParams: vec4f;
                uniform inkColor: vec3f;
                uniform inkTexelSize: vec2f;
                varying uv0: vec2f;

                fn inverseDepth(uv: vec2f) -> f32 {
                    return 1.0 / getLinearScreenDepth(uv);
                }

                fn luminance(uv: vec2f) -> f32 {
                    return dot(textureSampleLevel(uSceneColorMap, uSceneColorMapSampler, uv, 0.0).rgb, vec3f(0.2126, 0.7152, 0.0722));
                }

                fn contrast(a: f32, b: f32) -> f32 {
                    return abs(a - b) / (a + b + 0.05);
                }

                // the center of the texel a position is in
                fn snapToTexel(uv: vec2f) -> vec2f {
                    return (floor(uv / uniform.inkTexelSize) + 0.5) * uniform.inkTexelSize;
                }

                // the ink at a texel center, comparing the samples a and b away on both diagonals
                fn inkAt(uv: vec2f, a: vec2f, b: vec2f) -> f32 {

                    // The inverse of the depth changes linearly across a flat surface, so its second
                    // difference is zero there, and lines appear at silhouettes and creases only.
                    // Relative to the depth, it does not depend on the distance.
                    let center = inverseDepth(uv);
                    let depthEdge = (abs(inverseDepth(uv + a) + inverseDepth(uv - a) - 2.0 * center) +
                                     abs(inverseDepth(uv + b) + inverseDepth(uv - b) - 2.0 * center)) / center;

                    // abrupt changes of the brightness, such as the outlines of the shadows
                    let colorEdge = max(contrast(luminance(uv + a), luminance(uv - a)),
                                        contrast(luminance(uv + b), luminance(uv - b)));

                    return max(smoothstep(uniform.inkParams.y, uniform.inkParams.y * 2.0, depthEdge),
                               smoothstep(uniform.inkParams.z, uniform.inkParams.z * 2.0, colorEdge));
                }

                @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                    var output: FragmentOutput;

                    // The depth is read from the nearest texel, so the samples compared are a whole
                    // number of texels away from a texel center - on a flat surface they are then the
                    // same distance away on both sides, and their second difference stays zero.
                    let a = uniform.inkTexelSize * uniform.inkParams.x;
                    let b = vec2f(a.x, -a.y);

                    // The ink averaged over four positions spread across the pixel in a rotated grid,
                    // scaled with the width of the lines. The lines then fade out over a pixel or more
                    // at their edges, instead of stepping between the pixels.
                    let ink = (inkAt(snapToTexel(uv0 + a * vec2f(-0.375, -0.125)), a, b) +
                               inkAt(snapToTexel(uv0 + a * vec2f(0.125, -0.375)), a, b) +
                               inkAt(snapToTexel(uv0 + a * vec2f(0.375, 0.125)), a, b) +
                               inkAt(snapToTexel(uv0 + a * vec2f(-0.125, 0.375)), a, b)) * 0.25 * uniform.inkParams.w;
                    if (ink <= 0.0) {
                        discard;
                    }

                    let scene = textureSampleLevel(uSceneColorMap, uSceneColorMapSampler, uv0, 0.0);
                    output.color = vec4f(mix(scene.rgb, uniform.inkColor, ink), scene.a);
                    return output;
                }
            `
        });

        const scope = device.scope;
        this.paramsId = scope.resolve('inkParams');
        this.colorId = scope.resolve('inkColor');
        this.texelSizeId = scope.resolve('inkTexelSize');
        this.cameraParamsId = scope.resolve('camera_params');
        this._params = new Float32Array(4);
        this._color = new Float32Array(3);
        this._texelSize = new Float32Array(2);
        this._cameraParams = new Float32Array(4);
    }

    execute() {
        const params = this._params;
        params[0] = Math.max(Math.round(this.width), 1);
        params[1] = this.depthThreshold;
        params[2] = this.colorThreshold;
        params[3] = this.intensity;
        this.paramsId.setValue(params);

        this._color[0] = this.color.r;
        this._color[1] = this.color.g;
        this._color[2] = this.color.b;
        this.colorId.setValue(this._color);

        this._texelSize[0] = this.texelWidth;
        this._texelSize[1] = this.texelHeight;
        this.texelSizeId.setValue(this._texelSize);

        // the camera planes, which reading the depth can depend on
        const { farClip, nearClip, projection } = this.cameraComponent;
        const cameraParams = this._cameraParams;
        cameraParams[0] = 1 / farClip;
        cameraParams[1] = farClip;
        cameraParams[2] = nearClip;
        cameraParams[3] = projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
        this.cameraParamsId.setValue(cameraParams);

        super.execute();
    }
}

// The effect owns the pass: it creates it in createPasses, and destroys it in destroyPasses. The
// resources it lists in `requires` are what the camera frame provides to it:
// - the copy of the opaque scene color, which the camera frame takes because the effect requires it,
// - the render target the scene renders to, which the pass draws the lines into,
// - the scene depth, which at this point holds the depth of the opaque geometry.
// The pass is added to the postOpaque stage, running after the opaque geometry and before the
// transparent geometry, which renders over the lines.
class InkOutlineEffect extends CameraFrameEffect {
    // The width of the lines, in whole pixels
    width = 3;

    // How sensitive the lines are to changes of the depth - lower values draw more lines
    depthThreshold = 0.002;

    // How sensitive the lines are to changes of the brightness - lower values draw more lines
    colorThreshold = 0.48;

    // How dark the lines are, 0-1
    intensity = 1;

    // The color of the ink
    color = new Color(0.02, 0.02, 0.05);

    /** @type {RenderPassInkOutline|null} */
    _pass = null;

    constructor(device) {
        super(device, 'inkOutline', {
            requires: [FRAMERESOURCE_SCENECOLORGRAB, FRAMERESOURCE_SCENETARGET, FRAMERESOURCE_DEPTH]
        });
    }

    createPasses(resources, passes) {
        this._pass = new RenderPassInkOutline(this.device, this.cameraFrame.cameraComponent, resources.depth);
        this._pass.init(resources.sceneTarget);
        passes.postOpaque.push(this._pass);
    }

    destroyPasses() {
        this._pass?.destroy();
        this._pass = null;
    }

    // called by cameraFrame.update(), the values apply to the frames rendered after it
    update() {
        const pass = this._pass;
        pass.width = this.width;
        pass.depthThreshold = this.depthThreshold;
        pass.colorThreshold = this.colorThreshold;
        pass.intensity = this.intensity;
        pass.color.copy(this.color);
    }

    // called every frame, with the resolution the scene renders at this frame, which the pass
    // rendering into the scene has
    frameUpdate(frame) {
        this._pass.texelWidth = 1 / frame.renderWidth;
        this._pass.texelHeight = 1 / frame.renderHeight;
    }
}

// ------ The camera frame ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.02;

const inkOutline = new InkOutlineEffect(device);
cameraFrame.addEffect(inkOutline);

// ------ Animation ------

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // the bubbles rise, swaying, and start again at the bottom
    for (const bubble of bubbles) {
        const height = (bubble.height + time * bubble.speed) % 20;
        const angle = bubble.angle + time * 0.1;
        const sway = Math.sin(time * 1.5 + bubble.angle * 5) * 0.5;
        bubble.entity.setLocalPosition(
            Math.cos(angle) * bubble.distance + sway,
            height,
            Math.sin(angle) * bubble.distance
        );
    }
});

// ------ The controls ------

const applySettings = () => {
    cameraFrame.rendering.samples = data.get('data.rendering.msaa') ? 4 : 1;
    cameraFrame.taa.enabled = data.get('data.rendering.taa');
    inkOutline.enabled = data.get('data.outline.enabled');
    inkOutline.width = data.get('data.outline.width');
    inkOutline.depthThreshold = data.get('data.outline.depthThreshold');
    inkOutline.colorThreshold = data.get('data.outline.colorThreshold');
    inkOutline.intensity = data.get('data.outline.intensity');
    cameraFrame.update();
};

// Set initial values
data.set('data', {
    outline: {
        enabled: true,
        width: 3,
        depthThreshold: 0.002,
        colorThreshold: 0.48,
        intensity: 1
    },
    rendering: {
        msaa: false,
        taa: false
    }
});

// Apply UI changes, applied by cameraFrame.update()
data.on('*:set', applySettings);

applySettings();
