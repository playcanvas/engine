// @config
//
// Generates the textures of a material on the GPU, using two render passes which are not attached
// to any camera. The first pass renders an animated pattern into a texture, storing its color, and
// its height in the alpha channel. The second pass renders a normal map from that height. The
// passes render from the `prerender` event, before the cameras render the scene - every frame
// while animating, and otherwise only when a setting changes. The mipmaps of both textures are
// regenerated each time they are rendered.

import {
    ADDRESS_REPEAT,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGBA8,
    QuadRender,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderPass,
    RenderTarget,
    SEMANTIC_POSITION,
    SHADOW_PCF3_32F,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderUtils,
    SphereGeometry,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    TextureRenderer,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

import noiseGlslFrag from './noise.glsl.frag';
import noiseWgslFrag from './noise.wgsl.frag';
import normalsGlslFrag from './normals.glsl.frag';
import normalsWgslFrag from './normals.wgsl.frag';

/**
 * @import { GraphicsDevice } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// A render pass rendering an animated pattern into its render target, using a quad covering the
// whole target. It is a plain RenderPass, which is not attached to any camera, and renders each
// time its render function is called.
class RenderPassPattern extends RenderPass {
    /** The animation time. */
    time = 0;

    /** The number of noise cells across the texture. Needs to be a whole number to tile. */
    scale = 4;

    /** The colors the pattern is shaded with, in linear space. */
    colors = {
        base: new Float32Array(3),
        mid: new Float32Array(3),
        high: new Float32Array(3),
        vein: new Float32Array(3)
    };

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device);

        const shader = ShaderUtils.createShader(device, {
            uniqueName: 'PatternShader',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentGLSL: noiseGlslFrag,
            fragmentWGSL: noiseWgslFrag
        });

        // the quad the pass renders
        this.quadRender = new QuadRender(shader);

        // resolve the uniforms once, instead of each time the pass renders
        const scope = device.scope;
        this.timeId = scope.resolve('uTime');
        this.scaleId = scope.resolve('uScale');
        this.colorBaseId = scope.resolve('uColorBase');
        this.colorMidId = scope.resolve('uColorMid');
        this.colorHighId = scope.resolve('uColorHigh');
        this.colorVeinId = scope.resolve('uColorVein');
    }

    setColors(/** @type {string[]} */ palette) {
        const color = new Color();
        Object.values(this.colors).forEach((value, index) => {
            color.fromString(palette[index]).linear();
            value.set([color.r, color.g, color.b]);
        });
    }

    // called between the start and the end of the GPU render pass, to issue the draw calls
    execute() {
        this.timeId.setValue(this.time);
        this.scaleId.setValue(this.scale);
        this.colorBaseId.setValue(this.colors.base);
        this.colorMidId.setValue(this.colors.mid);
        this.colorHighId.setValue(this.colors.high);
        this.colorVeinId.setValue(this.colors.vein);

        // the default draw states suit a quad: no blending, and no depth test or write
        this.device.setDrawStates();
        this.quadRender.render();
    }

    destroy() {
        this.quadRender.destroy();
        this.quadRender = null;
        super.destroy();
    }
}

// A render pass rendering a normal map from the height stored in the alpha of a texture.
class RenderPassNormalMap extends RenderPass {
    /** The strength of the bumps. */
    bumpiness = 1;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture} heightTexture - The texture storing the height in its alpha channel.
     */
    constructor(device, heightTexture) {
        super(device);
        this.heightTexture = heightTexture;

        const shader = ShaderUtils.createShader(device, {
            uniqueName: 'NormalMapShader',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentGLSL: normalsGlslFrag,
            fragmentWGSL: normalsWgslFrag
        });
        this.quadRender = new QuadRender(shader);

        const scope = device.scope;
        this.heightTextureId = scope.resolve('uHeightTexture');
        this.texelSizeId = scope.resolve('uTexelSize');
        this.bumpinessId = scope.resolve('uBumpiness');
        this.texelSize = new Float32Array(2);
    }

    execute() {
        const { heightTexture, texelSize } = this;
        texelSize[0] = 1 / heightTexture.width;
        texelSize[1] = 1 / heightTexture.height;

        this.heightTextureId.setValue(heightTexture);
        this.texelSizeId.setValue(texelSize);
        this.bumpinessId.setValue(this.bumpiness);

        this.device.setDrawStates();
        this.quadRender.render();
    }

    destroy() {
        this.quadRender.destroy();
        this.quadRender = null;
        super.destroy();
    }
}

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
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

// the colors of the pattern: base, mid, high and veins, in sRGB space
const palettes = {
    agate: ['#2a1640', '#c45a2c', '#f2c58a', '#f7eee2'],
    malachite: ['#06291f', '#127a52', '#7fd1a4', '#021710'],
    marble: ['#c9c2b6', '#8f8273', '#ebe5da', '#2a211b']
};

data.set('settings', {
    animate: true,
    speed: 1,
    palette: 'agate',
    scale: 2,
    bumpiness: 2,
    resolution: 512,
    preview: true
});

// image based lighting from the environment, with a blurred skybox
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.skyboxIntensity = 0.7;

// ------ The textures generated by the render passes ------

// The color texture, storing the height in its alpha channel. A half float format gives the
// height enough precision for smooth normals. Without it, an sRGB format stores the color with
// more precision in the darks than a linear 8-bit format would.
const createTexture = (/** @type {string} */ name, /** @type {number} */ format, /** @type {number} */ size) => {
    return new Texture(device, {
        name,
        width: size,
        height: size,
        format,
        // the mipmaps are regenerated after each render pass rendering to the texture
        mipmaps: true,
        minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: FILTER_LINEAR,
        // the pattern tiles, and repeats over the objects
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        anisotropy: 8
    });
};

const size = data.get('settings.resolution');
const colorFormat = device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F : PIXELFORMAT_SRGBA8;
const colorTexture = createTexture('PatternColor', colorFormat, size);
const normalTexture = createTexture('PatternNormals', PIXELFORMAT_RGBA8, size);

// render targets to render into the textures, without depth buffers, as quads do not need them
const colorTarget = new RenderTarget({ name: 'PatternColor', colorBuffer: colorTexture, depth: false });
const normalTarget = new RenderTarget({ name: 'PatternNormals', colorBuffer: normalTexture, depth: false });

// ------ The render passes ------

const patternPass = new RenderPassPattern(device);
patternPass.init(colorTarget);

const normalMapPass = new RenderPassNormalMap(device, colorTexture);
normalMapPass.init(normalTarget);

// The quads cover the whole textures, so their previous content is not needed. Clearing them,
// instead of loading the content, avoids reading it back from memory on tiled mobile GPUs.
patternPass.setClearColor(Color.BLACK);
normalMapPass.setClearColor(Color.BLACK);

app.on('destroy', () => {
    patternPass.destroy();
    normalMapPass.destroy();
    [colorTarget, normalTarget].forEach((target) => {
        target.destroyTextureBuffers();
        target.destroy();
    });
});

// ------ The scene ------

// a material using the generated textures, tiling them by the specified amount
const createMaterial = (/** @type {number} */ tilingU, /** @type {number} */ tilingV) => {
    const material = new StandardMaterial();
    material.diffuseMap = colorTexture;
    material.diffuseMapTiling = new Vec2(tilingU, tilingV);
    material.normalMap = normalTexture;
    material.normalMapTiling = new Vec2(tilingU, tilingV);
    material.gloss = 0.6;
    material.useMetalness = true;
    material.metalness = 0;
    material.update();
    return material;
};

// a cube using the textures
const cube = new Entity('Cube');
cube.addComponent('render', {
    type: 'box',
    material: createMaterial(1, 1)
});
cube.setLocalPosition(0, 0.5, 0);
cube.setLocalEulerAngles(0, 30, 0);
app.root.addChild(cube);

// a finely tessellated sphere resting on the cube, its texture tiled twice around it
const sphereMesh = Mesh.fromGeometry(
    device,
    new SphereGeometry({ radius: 0.5, latitudeBands: 64, longitudeBands: 64 })
);
const sphere = new Entity('Sphere');
sphere.addComponent('render', {
    meshInstances: [new MeshInstance(sphereMesh, createMaterial(2, 1))]
});
sphere.setLocalPosition(0, 1.5, 0);
// the poles of the sphere, where its texture converges, face sideways
sphere.setLocalEulerAngles(0, 0, 90);
app.root.addChild(sphere);

const objects = [cube, sphere];

// the ground receiving the shadows, using the same textures, repeating them every unit like the cube
const ground = new Entity('Ground');
ground.addComponent('render', {
    type: 'plane',
    material: createMaterial(3, 3),
    castShadows: false
});
ground.setLocalScale(3, 1, 3);
app.root.addChild(ground);

// a directional light casting soft shadows
const light = new Entity('Light');
light.addComponent('light', {
    type: 'directional',
    intensity: 1.2,
    castShadows: true,
    shadowType: SHADOW_PCF3_32F,
    shadowResolution: 2048,
    shadowDistance: 12,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
light.setLocalEulerAngles(50, 30, 0);
app.root.addChild(light);

// the camera, orbiting the objects, staying above the ground
const camera = new Entity('Camera');
camera.addComponent('camera', {
    toneMapping: TONEMAP_ACES,
    farClip: 100
});
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        distanceMin: 2,
        distanceMax: 12,
        pitchAngleMin: 5,
        pitchAngleMax: 80
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);
camera.script.orbitCamera.resetAndLookAtPoint(new Vec3(0.4, 2.2, 4.6), new Vec3(0.4, 0.9, 0));

// ------ Rendering the textures ------

// the passes render only when their output changes
let patternDirty = true;
let normalsDirty = true;

const applySettings = () => {
    const settings = data.get('settings');
    patternPass.scale = Math.round(settings.scale);
    patternPass.setColors(palettes[settings.palette]);

    // the slopes of the pattern get steeper with the scale, so the bumpiness is scaled down by it
    normalMapPass.bumpiness = (0.12 * settings.bumpiness) / patternPass.scale;
};
applySettings();

data.on('*:set', (/** @type {string} */ path) => {
    switch (path) {
        case 'settings.resolution': {
            // resizing the render targets resizes their textures, which loses their content
            const resolution = data.get('settings.resolution');
            colorTarget.resize(resolution, resolution);
            normalTarget.resize(resolution, resolution);
            patternDirty = true;
            break;
        }
        case 'settings.palette':
        case 'settings.scale':
            applySettings();
            patternDirty = true;
            break;
        case 'settings.bumpiness':
            // only the normal map depends on the bumpiness
            applySettings();
            normalsDirty = true;
            break;
    }
});

// Render the passes before the cameras render the scene, which uses their textures. As they
// render to their own render targets, they can render at any point of the frame.
app.on('prerender', () => {
    if (patternDirty) {
        patternDirty = false;
        patternPass.render();

        // the normals depend on the pattern
        normalsDirty = true;
    }

    if (normalsDirty) {
        normalsDirty = false;
        normalMapPass.render();
    }
});

// shows the generated textures in a corner of the screen
const textureRenderer = new TextureRenderer(app);

app.on('update', (/** @type {number} */ dt) => {
    const settings = data.get('settings');

    if (settings.animate) {
        patternPass.time += dt * settings.speed;
        patternDirty = true;
    }

    // slowly spin the objects around their own axis
    objects.forEach((entity, index) => {
        entity.rotateLocal(0, (10 + 4 * index) * dt, 0);
    });

    // square previews at the bottom right corner, sized by the shorter side of the screen
    if (settings.preview) {
        const { width, height } = device;
        const side = 0.2 * Math.min(width, height);
        const margin = 0.1 * side;
        const w = side / width;
        const h = side / height;
        const y = 1 - (side + margin) / height;
        textureRenderer.draw(colorTexture, 1 - (2 * (side + margin)) / width, y, w, h);
        textureRenderer.draw(normalTexture, 1 - (side + margin) / width, y, w, h);
    }
});

export { app };
