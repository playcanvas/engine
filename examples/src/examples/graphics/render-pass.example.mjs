// @config
//
// @credit
// title: Chess Board
// author: Idmental
// source: https://sketchfab.com/3d-models/chess-board-901eeeca884f4622ac37b7e8f7cb82c3
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    Keyboard,
    LAYERID_UI,
    LightComponentSystem,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderPassForward,
    RenderPassShaderQuad,
    RenderTarget,
    SEMANTIC_POSITION,
    ShaderUtils,
    TEXTURETYPE_RGBP,
    Texture,
    TextureHandler,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// A simple render pass that renders a quad with a shader. The shader tints the source texture.
class RenderPassTint extends RenderPassShaderQuad {
    constructor(device, sourceTexture) {
        super(device);
        this.sourceTexture = sourceTexture;
        this.tint = Color.WHITE.clone();

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'TintShader',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',

            fragmentGLSL: /* glsl */ `
                uniform sampler2D sourceTexture;
                uniform vec3 tint;
                varying vec2 uv0;

                void main() {
                    vec4 color = texture2D(sourceTexture, uv0);
                    gl_FragColor = vec4(color.rgb * tint, color.a);
                }
            `,

            fragmentWGSL: /* wgsl */ `

                var sourceTexture: texture_2d<f32>;
                var sourceTextureSampler: sampler;
                uniform tint: vec3f;
                varying uv0: vec2f;
                
                @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                    var output: FragmentOutput;
                    let color: vec4f = textureSample(sourceTexture, sourceTextureSampler, uv0);
                    output.color = vec4f(color.rgb * uniform.tint, color.a);
                    return output;
                }
            `
        });
    }

    execute() {
        this.device.scope.resolve('sourceTexture').setValue(this.sourceTexture);
        this.device.scope.resolve('tint').setValue([this.tint.r, this.tint.g, this.tint.b]);
        super.execute();
    }
}

// set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    board: new Asset('statue', 'container', { url: './assets/models/chess-board.glb' }),
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
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// setup skydome
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 5;

// get the instance of the chess board and set up with render component
const boardEntity = assets.board.resource.instantiateRenderEntity({
    castShadows: false,
    receiveShadows: false
});
app.root.addChild(boardEntity);

// Create an Entity with a camera component, and attach postprocessing effects scripts on it
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    farClip: 500
});

// position the camera in the world
cameraEntity.setLocalPosition(0, 30, -60);
cameraEntity.lookAt(0, 0, 100);
app.root.addChild(cameraEntity);

// the scene gets rendered to a texture first
const texture = new Texture(device, {
    name: 'RTTexture',
    width: 4,
    height: 4,
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});

const rt = new RenderTarget({
    colorBuffer: texture,
    depth: true
});

// layers used in rendering
const worldLayer = app.scene.layers.getLayerByName('World');
const uiLayer = app.scene.layers.getLayerById(LAYERID_UI);

// use the render pass to render the world and ui layers to the created texture
const renderPass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);

// this render pass resizes the texture to match the size of are on the scene we render to
renderPass.init(rt, {
    resizeSource: null
});
renderPass.addLayer(cameraEntity.camera, worldLayer, false);
renderPass.addLayer(cameraEntity.camera, uiLayer, true);

// tint pass uses the scene rendered to a texture, and applies a tint to it
const tintPass = new RenderPassTint(app.graphicsDevice, texture);

// rendering goes directly to the front-buffer
tintPass.init(null);

// assign those two passes to the camera to be used instead of its default rendering
cameraEntity.camera.framePasses = [renderPass, tintPass];

// update things every frame
let angle = 3;
app.on('update', (/** @type {number} */ dt) => {
    angle += dt;

    // move the focus position in the world
    const focusPosition = new Vec3(0, 10, Math.sin(1 + angle * 0.3) * 90);

    // orbit the camera around
    cameraEntity.setLocalPosition(110 * Math.sin(angle * 0.2), 45, 110 * Math.cos(angle * 0.2));
    cameraEntity.lookAt(focusPosition);

    // tint color
    tintPass.tint.lerp(Color.YELLOW, Color.CYAN, Math.sin(angle * 0.5) * 0.5 + 0.5);
});
