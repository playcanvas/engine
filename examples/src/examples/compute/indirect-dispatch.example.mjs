// @config
//
// This example demonstrates indirect compute dispatch. A scan shader classifies tiles by detecting
// depth discontinuities (edges/silhouettes), then indirectly dispatches effect shaders to colorize
// edge (red) and smooth (blue) regions.
//
// @flag WEBGL_DISABLED
//
// @credit
// title: Wide Street 02
// author: Poly Haven
// source: https://polyhaven.com/a/wide_street_02
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BUFFERUSAGE_COPY_DST,
    BindGroupFormat,
    BindStorageBufferFormat,
    BindStorageTextureFormat,
    BindTextureFormat,
    BindUniformBufferFormat,
    CameraComponentSystem,
    Color,
    Compute,
    ContainerHandler,
    Entity,
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FILTER_NEAREST,
    GAMMA_SRGB,
    Layer,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_DEPTH,
    PIXELFORMAT_RGBA8,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    SAMPLETYPE_DEPTH,
    SAMPLETYPE_FLOAT,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    SKYTYPE_DOME,
    ScriptComponentSystem,
    ScriptHandler,
    Shader,
    StorageBuffer,
    TEXTUREDIMENSION_2D,
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    TouchDevice,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_UINT,
    UNIFORMTYPE_VEC3,
    UniformBufferFormat,
    UniformFormat,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

import effectShaderWgsl from './effect-shader.wgsl';
import scanShaderWgsl from './scan-shader.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    hdri: new Asset('hdri', 'texture', { url: './assets/hdri/wide-street.hdr' }, { mipmaps: false }),
    orbit: new Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' })
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Create a layer for the render target
const rtLayer = new Layer({ name: 'RTLayer' });
app.scene.layers.push(rtLayer);

// Get skybox layer for the RT camera
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');

const TILE_SIZE = 32;

// Camera parameters
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 500;

// Buffers and state
let renderTarget = null;
let depthTexture = null;
let edgeTileListBuffer = null;
let smoothTileListBuffer = null;
let edgeTileCounterBuffer = null;
let smoothTileCounterBuffer = null;
let completionCounterBuffer = null;
let outputTexture = null;
let scanCompute = null;
let effectComputeEdge = null;
let effectComputeSmooth = null;
let rtWidth = 0;
let rtHeight = 0;
let numTilesX = 0;
let numTilesY = 0;

// Reference to the RT camera (set during asset load)
let rtCamera = null;

// Create resources for the given dimensions
const createResources = () => {
    // Use half height for each texture (top = original, bottom = processed)
    rtWidth = device.width;
    rtHeight = Math.floor(device.height / 2);
    numTilesX = Math.ceil(rtWidth / TILE_SIZE);
    numTilesY = Math.ceil(rtHeight / TILE_SIZE);
    const numTiles = numTilesX * numTilesY;

    // Destroy old resources
    renderTarget?.colorBuffer?.destroy();
    depthTexture?.destroy();
    renderTarget?.destroy();
    edgeTileListBuffer?.destroy();
    smoothTileListBuffer?.destroy();
    edgeTileCounterBuffer?.destroy();
    smoothTileCounterBuffer?.destroy();
    completionCounterBuffer?.destroy();
    outputTexture?.destroy();

    // Create render target texture (source for compute)
    const colorBuffer = new Texture(device, {
        name: 'RT-ColorBuffer',
        width: rtWidth,
        height: rtHeight,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });

    // Create explicit depth texture for compute shader access
    depthTexture = new Texture(device, {
        name: 'RT-DepthBuffer',
        width: rtWidth,
        height: rtHeight,
        format: PIXELFORMAT_DEPTH,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });

    renderTarget = new RenderTarget({
        name: 'SceneRT',
        colorBuffer: colorBuffer,
        depthBuffer: depthTexture,
        samples: 1
    });

    // Create output storage texture (write-only destination for compute)
    outputTexture = new Texture(device, {
        name: 'OutputTexture',
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

    // Create tile list buffers (stores indices of tiles)
    edgeTileListBuffer = new StorageBuffer(device, numTiles * 4);
    smoothTileListBuffer = new StorageBuffer(device, numTiles * 4);

    // Create counter buffers (atomic counters, cleared each frame)
    edgeTileCounterBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_DST);
    smoothTileCounterBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_DST);
    completionCounterBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_DST);

    // Update camera's render target
    if (rtCamera) {
        rtCamera.camera.renderTarget = renderTarget;
    }
};

// Ensure canvas is resized when window changes size
const resize = () => {
    app.resizeCanvas();
    if (device.supportsCompute) {
        createResources();
    }
};
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// Setup skydome from HDR texture
const hdriSource = assets.hdri.resource;

// Convert to high resolution cubemap for the skybox
const skybox = EnvLighting.generateSkyboxCubemap(hdriSource);
app.scene.skybox = skybox;

// Generate env-atlas texture for the lighting
const lighting = EnvLighting.generateLightingSource(hdriSource);
const envAtlas = EnvLighting.generateAtlas(lighting);
lighting.destroy();
app.scene.envAtlas = envAtlas;

// Configure projected skydome
app.scene.sky.type = SKYTYPE_DOME;
app.scene.sky.node.setLocalScale(new Vec3(200, 200, 200));
app.scene.sky.node.setLocalPosition(new Vec3(0, 0, 0));
app.scene.sky.center = new Vec3(0, 0.05, 0);
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, 0, 0);
app.scene.exposure = 0.7;

// Add an instance of the statue
const statueEntity = assets.statue.resource.instantiateRenderEntity({
    layers: [rtLayer.id]
});
app.root.addChild(statueEntity);

// Initialize resources
if (device.supportsCompute) {
    createResources();
}

// Create camera that renders to the render target
rtCamera = new Entity('rtCamera');
rtCamera.addComponent('camera', {
    nearClip: CAMERA_NEAR,
    farClip: CAMERA_FAR,
    fov: 70,
    toneMapping: TONEMAP_ACES,
    gammaCorrection: GAMMA_SRGB,
    layers: [rtLayer.id, skyboxLayer.id],
    renderTarget: renderTarget
});

// Add orbit camera script
rtCamera.addComponent('script');
rtCamera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: statueEntity,
        distanceMax: 500,
        frameOnStart: false
    }
});
rtCamera.script.create('orbitCameraInputMouse');
rtCamera.script.create('orbitCameraInputTouch');

rtCamera.setLocalPosition(-4, 5, 22);
rtCamera.lookAt(0, 0, 1);
app.root.addChild(rtCamera);

// Create main camera (for final view - only immediate layer for drawTexture)
const immediateLayer = app.scene.layers.getLayerByName('Immediate');
const mainCamera = new Entity('mainCamera');
mainCamera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1),
    layers: [immediateLayer.id]
});
mainCamera.setPosition(0, 0, 0);
app.root.addChild(mainCamera);

if (device.supportsCompute) {
    // Shader defines - TILE_SIZE is used in both shaders
    const shaderDefines = new Map([['{TILE_SIZE}', `${TILE_SIZE}`]]);

    // Create scan shader (analyzes depth discontinuities and populates edge/smooth tile lists)
    const scanShader = new Shader(device, {
        name: 'ScanShader',
        shaderLanguage: SHADERLANGUAGE_WGSL,
        cshader: scanShaderWgsl,
        cdefines: shaderDefines,

        computeUniformBufferFormats: {
            ub: new UniformBufferFormat(device, [
                new UniformFormat('threshold', UNIFORMTYPE_FLOAT),
                new UniformFormat('cameraNear', UNIFORMTYPE_FLOAT),
                new UniformFormat('cameraFar', UNIFORMTYPE_FLOAT),
                new UniformFormat('numTilesX', UNIFORMTYPE_UINT),
                new UniformFormat('numTilesY', UNIFORMTYPE_UINT),
                // Slot indices into the indirect dispatch buffer where scan shader writes dispatch args
                new UniformFormat('edgeIndirectSlot', UNIFORMTYPE_UINT),
                new UniformFormat('smoothIndirectSlot', UNIFORMTYPE_UINT)
            ])
        },

        computeBindGroupFormat: new BindGroupFormat(device, [
            new BindUniformBufferFormat('ub', SHADERSTAGE_COMPUTE),
            new BindTextureFormat('depthTexture', SHADERSTAGE_COMPUTE, TEXTUREDIMENSION_2D, SAMPLETYPE_DEPTH, false), // depth texture, no sampler
            // Tile lists populated by scan shader, consumed by effect shaders
            new BindStorageBufferFormat('edgeTileList', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('smoothTileList', SHADERSTAGE_COMPUTE),
            // Atomic counters for tile classification
            new BindStorageBufferFormat('edgeTileCounter', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('smoothTileCounter', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('completionCounter', SHADERSTAGE_COMPUTE),
            // Indirect dispatch buffer - scan shader writes dispatch args here
            new BindStorageBufferFormat('indirectDispatchBuffer', SHADERSTAGE_COMPUTE)
        ])
    });

    // Create effect shader (reads from input, writes to output with tint)
    const effectShader = new Shader(device, {
        name: 'EffectShader',
        shaderLanguage: SHADERLANGUAGE_WGSL,
        cshader: effectShaderWgsl,
        cdefines: shaderDefines,

        computeUniformBufferFormats: {
            ub: new UniformBufferFormat(device, [
                new UniformFormat('numTilesX', UNIFORMTYPE_UINT),
                new UniformFormat('numTilesY', UNIFORMTYPE_UINT),
                new UniformFormat('tintColor', UNIFORMTYPE_VEC3)
            ])
        },

        computeBindGroupFormat: new BindGroupFormat(device, [
            new BindUniformBufferFormat('ub', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('tileList', SHADERSTAGE_COMPUTE, true), // read-only
            new BindTextureFormat('inputTexture', SHADERSTAGE_COMPUTE, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, false), // no sampler, using textureLoad
            new BindStorageTextureFormat('outputTexture', PIXELFORMAT_RGBA8, TEXTUREDIMENSION_2D)
        ])
    });

    // Create compute instances
    scanCompute = new Compute(device, scanShader, 'ScanCompute');
    effectComputeEdge = new Compute(device, effectShader, 'EffectComputeEdge');
    effectComputeSmooth = new Compute(device, effectShader, 'EffectComputeSmooth');

    // Set initial data values
    data.set('data', {
        threshold: 15 // threshold is in world units - depth range within tile that triggers edge detection
    });

    // Update loop
    app.on('update', (/** @type {number} */ _dt) => {
        if (!device.supportsCompute || !scanCompute || !effectComputeEdge || !effectComputeSmooth) {
            return;
        }

        // Get threshold from UI
        const threshold = data.get('data.threshold') ?? 0.02;

        // Clear all counter buffers each frame
        edgeTileCounterBuffer.clear();
        smoothTileCounterBuffer.clear();
        completionCounterBuffer.clear();

        // Allocate two slots in the indirect dispatch buffer for this frame
        const edgeIndirectSlot = device.getIndirectDispatchSlot();
        const smoothIndirectSlot = device.getIndirectDispatchSlot();

        // --- Pass 1: Scan tiles and classify by depth discontinuity ---
        scanCompute.setParameter('threshold', threshold);
        scanCompute.setParameter('cameraNear', CAMERA_NEAR);
        scanCompute.setParameter('cameraFar', CAMERA_FAR);
        scanCompute.setParameter('numTilesX', numTilesX);
        scanCompute.setParameter('numTilesY', numTilesY);
        scanCompute.setParameter('edgeIndirectSlot', edgeIndirectSlot);
        scanCompute.setParameter('smoothIndirectSlot', smoothIndirectSlot);
        scanCompute.setParameter('depthTexture', depthTexture);
        scanCompute.setParameter('edgeTileList', edgeTileListBuffer);
        scanCompute.setParameter('smoothTileList', smoothTileListBuffer);
        scanCompute.setParameter('edgeTileCounter', edgeTileCounterBuffer);
        scanCompute.setParameter('smoothTileCounter', smoothTileCounterBuffer);
        scanCompute.setParameter('completionCounter', completionCounterBuffer);
        scanCompute.setParameter('indirectDispatchBuffer', device.indirectDispatchBuffer);

        scanCompute.setupDispatch(numTilesX, numTilesY, 1);
        device.computeDispatch([scanCompute], 'ScanDispatch');

        // --- Pass 2: Apply red tint to edge tiles (indirect dispatch) ---
        effectComputeEdge.setParameter('numTilesX', numTilesX);
        effectComputeEdge.setParameter('numTilesY', numTilesY);
        effectComputeEdge.setParameter('tintColor', [1.0, 0.3, 0.3]);
        effectComputeEdge.setParameter('tileList', edgeTileListBuffer);
        effectComputeEdge.setParameter('inputTexture', renderTarget.colorBuffer);
        effectComputeEdge.setParameter('outputTexture', outputTexture);

        effectComputeEdge.setupIndirectDispatch(edgeIndirectSlot);
        device.computeDispatch([effectComputeEdge], 'EffectEdgeDispatch');

        // --- Pass 3: Apply blue tint to smooth tiles (indirect dispatch) ---
        effectComputeSmooth.setParameter('numTilesX', numTilesX);
        effectComputeSmooth.setParameter('numTilesY', numTilesY);
        effectComputeSmooth.setParameter('tintColor', [0.3, 0.3, 1.0]);
        effectComputeSmooth.setParameter('tileList', smoothTileListBuffer);
        effectComputeSmooth.setParameter('inputTexture', renderTarget.colorBuffer);
        effectComputeSmooth.setParameter('outputTexture', outputTexture);

        effectComputeSmooth.setupIndirectDispatch(smoothIndirectSlot);
        device.computeDispatch([effectComputeSmooth], 'EffectSmoothDispatch');

        // Display textures with a small gap between them
        const gap = 0.02;

        // Top half: original RT texture
        app.drawTexture(0, 0.5 - gap * 0.5, 2.0 - gap * 2, 1.0 - gap * 2, renderTarget.colorBuffer);

        // Bottom half: compute-processed texture (red edge tiles, blue smooth tiles)
        app.drawTexture(0, -0.5 + gap * 0.5, 2.0 - gap * 2, 1.0 - gap * 2, outputTexture);
    });
}
