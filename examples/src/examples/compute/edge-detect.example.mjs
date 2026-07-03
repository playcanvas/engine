// @config
//
// A compute shader reads from a render target texture, applies edge detection and highlights edges in
// red.
//
// @flag WEBGL_DISABLED
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
    Compute,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    Layer,
    LightComponentSystem,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    SHADERLANGUAGE_WGSL,
    ScriptComponentSystem,
    Shader,
    TEXTURETYPE_RGBP,
    Texture,
    TextureHandler,
    Vec3,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

await new Promise((resolve) => {
    WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const assets = {
    board: new Asset('board', 'container', { url: './assets/models/chess-board.glb' }),
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

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

let renderTarget = null;
let rtCamera = null;
let computeShader = null;
let compute = null;
let storageTexture = null;
let rtWidth = 0;
let rtHeight = 0;

// Ensure canvas is resized when window changes size
const resize = () => {
    app.resizeCanvas();

    // Resize render target and storage texture to match new screen size
    if (renderTarget && storageTexture) {
        rtWidth = device.width;
        rtHeight = Math.floor(device.height / 2);

        renderTarget.resize(rtWidth, rtHeight);
        storageTexture.resize(rtWidth, rtHeight);
    }
};
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Create a layer for the render target
const rtLayer = new Layer({ name: 'RTLayer' });
app.scene.layers.push(rtLayer);

// Load assets and create the scene
await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Set up environment lighting
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;

// Create a directional light
const light = new Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    intensity: 1
});
light.setEulerAngles(45, 45, 0);
app.root.addChild(light);

// Create main camera (for final view)
const mainCamera = new Entity('mainCamera');
mainCamera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.3)
});
mainCamera.setPosition(0, 0, 0);
app.root.addChild(mainCamera);

// Create the render target with MSAA support
const createRenderTarget = (useMsaa) => {
    // Use screen dimensions (half height for each texture)
    rtWidth = device.width;
    rtHeight = Math.floor(device.height / 2);

    // Create a single-sample texture that will receive the resolved result
    const texture = new Texture(device, {
        name: 'RT-Texture',
        width: rtWidth,
        height: rtHeight,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });

    // Create render target with optional MSAA
    // When samples > 1, PlayCanvas creates internal MSAA buffers and resolves to the colorBuffer
    const rt = new RenderTarget({
        name: 'MSAA-RT',
        colorBuffer: texture,
        depth: true,
        samples: useMsaa ? 4 : 1
    });

    return rt;
};

// Create storage texture for compute output
const createStorageTexture = () => {
    return new Texture(device, {
        name: 'Storage-Texture',
        width: rtWidth,
        height: rtHeight,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        storage: true
    });
};

// Create the compute shader
const createComputeShader = () => {
    if (!device.supportsCompute) return null;

    // No computeBindGroupFormat is provided - the input texture (+ sampler) and the output
    // storage texture use the simplified WGSL syntax and are reflected automatically by the
    // engine from the shader source.
    return new Shader(device, {
        name: 'EdgeDetect-Shader',
        shaderLanguage: SHADERLANGUAGE_WGSL,
        cshader: computeShaderWgsl
    });
};

// Create camera that renders to the render target
let cameraAngle = 0;
const createRTCamera = (rt) => {
    const cam = new Entity('rtCamera');
    cam.addComponent('camera', {
        clearColor: new Color(1, 1, 1),
        renderTarget: rt,
        farClip: 500,
        layers: [rtLayer.id]
    });
    // Position like in multi-view example
    cam.setLocalPosition(100, 35, 0);
    cam.lookAt(Vec3.ZERO);
    app.root.addChild(cam);
    return cam;
};

// Create the chess board entity - only render in RT layer
const boardEntity = assets.board.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true,
    layers: [rtLayer.id]
});
app.root.addChild(boardEntity);

// Create the compute shader (only once)
computeShader = createComputeShader();

// Create resources with MSAA enabled
renderTarget = createRenderTarget(true);
rtCamera = createRTCamera(renderTarget);
storageTexture = createStorageTexture();

// Create compute instance if supported
if (device.supportsCompute && computeShader) {
    compute = new Compute(device, computeShader, 'EdgeDetect');

    // Set up the compute parameters
    // Note: sampler is automatically handled by PlayCanvas when hasSampler: true
    compute.setParameter('inputTexture', renderTarget.colorBuffer);
    compute.setParameter('outputTexture', storageTexture);
}

// Update loop
let time = 0;
app.on('update', (dt) => {
    time += dt;

    // Orbit camera around the scene
    if (rtCamera) {
        cameraAngle = time * 0.2;
        rtCamera.setLocalPosition(100 * Math.sin(cameraAngle), 35, 100 * Math.cos(cameraAngle));
        rtCamera.lookAt(Vec3.ZERO);
    }

    if (device.supportsCompute && compute && renderTarget) {
        // Set up dispatch dimensions (workgroup size is 8x8 in shader)
        const workgroupsX = Math.ceil(rtWidth / 8);
        const workgroupsY = Math.ceil(rtHeight / 8);
        compute.setupDispatch(workgroupsX, workgroupsY, 1);

        // Dispatch the compute shader
        device.computeDispatch([compute], 'EdgeDetect-Dispatch');

        const gap = 0.02;

        // Top half: original RT texture
        app.drawTexture(0, 0.5 - gap * 0.5, 2.0 - gap * 2, 1.0 - gap * 2, renderTarget.colorBuffer);

        // Bottom half: compute-processed texture
        app.drawTexture(0, -0.5 + gap * 0.5, 2.0 - gap * 2, 1.0 - gap * 2, storageTexture);
    }
});
