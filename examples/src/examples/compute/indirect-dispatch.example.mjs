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

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

import effectShaderWgsl from './effect-shader.wgsl';
import scanShaderWgsl from './scan-shader.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    statue: new pc.Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    hdri: new pc.Asset('hdri', 'texture', { url: './assets/hdri/wide-street.hdr' }, { mipmaps: false }),
    orbit: new pc.Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// create a layer for the render target
const rtLayer = new pc.Layer({ name: 'RTLayer' });
app.scene.layers.push(rtLayer);

// get skybox layer for the rt camera
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');

const TILE_SIZE = 32;

// camera parameters
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 500;

// buffers and state
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

// reference to the rt camera (set during asset load)
let rtCamera = null;

// create resources for the given dimensions
const createResources = () => {
    // use half height for each texture (top = original, bottom = processed)
    rtWidth = device.width;
    rtHeight = Math.floor(device.height / 2);
    numTilesX = Math.ceil(rtWidth / TILE_SIZE);
    numTilesY = Math.ceil(rtHeight / TILE_SIZE);
    const numTiles = numTilesX * numTilesY;

    // destroy old resources
    renderTarget?.colorBuffer?.destroy();
    depthTexture?.destroy();
    renderTarget?.destroy();
    edgeTileListBuffer?.destroy();
    smoothTileListBuffer?.destroy();
    edgeTileCounterBuffer?.destroy();
    smoothTileCounterBuffer?.destroy();
    completionCounterBuffer?.destroy();
    outputTexture?.destroy();

    // create render target texture (source for compute)
    const colorBuffer = new pc.Texture(device, {
        name: 'RT-ColorBuffer',
        width: rtWidth,
        height: rtHeight,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    // create explicit depth texture for compute shader access
    depthTexture = new pc.Texture(device, {
        name: 'RT-DepthBuffer',
        width: rtWidth,
        height: rtHeight,
        format: pc.PIXELFORMAT_DEPTH,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    renderTarget = new pc.RenderTarget({
        name: 'SceneRT',
        colorBuffer: colorBuffer,
        depthBuffer: depthTexture,
        samples: 1
    });

    // create output storage texture (write-only destination for compute)
    outputTexture = new pc.Texture(device, {
        name: 'OutputTexture',
        width: rtWidth,
        height: rtHeight,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        storage: true
    });

    // create tile list buffers (stores indices of tiles)
    edgeTileListBuffer = new pc.StorageBuffer(device, numTiles * 4);
    smoothTileListBuffer = new pc.StorageBuffer(device, numTiles * 4);

    // create counter buffers (atomic counters, cleared each frame)
    edgeTileCounterBuffer = new pc.StorageBuffer(device, 4, pc.BUFFERUSAGE_COPY_DST);
    smoothTileCounterBuffer = new pc.StorageBuffer(device, 4, pc.BUFFERUSAGE_COPY_DST);
    completionCounterBuffer = new pc.StorageBuffer(device, 4, pc.BUFFERUSAGE_COPY_DST);

    // update camera's render target
    if (rtCamera) {
        rtCamera.camera.renderTarget = renderTarget;
    }
};

// ensure canvas is resized when window changes size
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

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// setup skydome from hdr texture
const hdriSource = assets.hdri.resource;

// convert to high resolution cubemap for the skybox
const skybox = pc.EnvLighting.generateSkyboxCubemap(hdriSource);
app.scene.skybox = skybox;

// generate env-atlas texture for the lighting
const lighting = pc.EnvLighting.generateLightingSource(hdriSource);
const envAtlas = pc.EnvLighting.generateAtlas(lighting);
lighting.destroy();
app.scene.envAtlas = envAtlas;

// configure projected skydome
app.scene.sky.type = pc.SKYTYPE_DOME;
app.scene.sky.node.setLocalScale(new pc.Vec3(200, 200, 200));
app.scene.sky.node.setLocalPosition(new pc.Vec3(0, 0, 0));
app.scene.sky.center = new pc.Vec3(0, 0.05, 0);
app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 0, 0);
app.scene.exposure = 0.7;

// add an instance of the statue
const statueEntity = assets.statue.resource.instantiateRenderEntity({
    layers: [rtLayer.id]
});
app.root.addChild(statueEntity);

// initialize resources
if (device.supportsCompute) {
    createResources();
}

// create camera that renders to the render target
rtCamera = new pc.Entity('rtCamera');
rtCamera.addComponent('camera', {
    nearClip: CAMERA_NEAR,
    farClip: CAMERA_FAR,
    fov: 70,
    toneMapping: pc.TONEMAP_ACES,
    gammaCorrection: pc.GAMMA_SRGB,
    layers: [rtLayer.id, skyboxLayer.id],
    renderTarget: renderTarget
});

// add orbit camera script
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

// create main camera (for final view - only immediate layer for drawtexture)
const immediateLayer = app.scene.layers.getLayerByName('Immediate');
const mainCamera = new pc.Entity('mainCamera');
mainCamera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    layers: [immediateLayer.id]
});
mainCamera.setPosition(0, 0, 0);
app.root.addChild(mainCamera);

if (device.supportsCompute) {
    // shader defines - tile_size is used in both shaders
    const shaderDefines = new Map([['{TILE_SIZE}', `${TILE_SIZE}`]]);

    // create scan shader (analyzes depth discontinuities and populates edge/smooth tile lists)
    const scanShader = new pc.Shader(device, {
        name: 'ScanShader',
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,
        cshader: scanShaderWgsl,
        cdefines: shaderDefines,

        computeUniformBufferFormats: {
            ub: new pc.UniformBufferFormat(device, [
                new pc.UniformFormat('threshold', pc.UNIFORMTYPE_FLOAT),
                new pc.UniformFormat('cameraNear', pc.UNIFORMTYPE_FLOAT),
                new pc.UniformFormat('cameraFar', pc.UNIFORMTYPE_FLOAT),
                new pc.UniformFormat('numTilesX', pc.UNIFORMTYPE_UINT),
                new pc.UniformFormat('numTilesY', pc.UNIFORMTYPE_UINT),
                // slot indices into the indirect dispatch buffer where scan shader writes dispatch args
                new pc.UniformFormat('edgeIndirectSlot', pc.UNIFORMTYPE_UINT),
                new pc.UniformFormat('smoothIndirectSlot', pc.UNIFORMTYPE_UINT)
            ])
        },

        computeBindGroupFormat: new pc.BindGroupFormat(device, [
            new pc.BindUniformBufferFormat('ub', pc.SHADERSTAGE_COMPUTE),
            new pc.BindTextureFormat(
                'depthTexture',
                pc.SHADERSTAGE_COMPUTE,
                pc.TEXTUREDIMENSION_2D,
                pc.SAMPLETYPE_DEPTH,
                false
            ), // depth texture, no sampler
            // tile lists populated by scan shader, consumed by effect shaders
            new pc.BindStorageBufferFormat('edgeTileList', pc.SHADERSTAGE_COMPUTE),
            new pc.BindStorageBufferFormat('smoothTileList', pc.SHADERSTAGE_COMPUTE),
            // atomic counters for tile classification
            new pc.BindStorageBufferFormat('edgeTileCounter', pc.SHADERSTAGE_COMPUTE),
            new pc.BindStorageBufferFormat('smoothTileCounter', pc.SHADERSTAGE_COMPUTE),
            new pc.BindStorageBufferFormat('completionCounter', pc.SHADERSTAGE_COMPUTE),
            // indirect dispatch buffer - scan shader writes dispatch args here
            new pc.BindStorageBufferFormat('indirectDispatchBuffer', pc.SHADERSTAGE_COMPUTE)
        ])
    });

    // create effect shader (reads from input, writes to output with tint)
    const effectShader = new pc.Shader(device, {
        name: 'EffectShader',
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,
        cshader: effectShaderWgsl,
        cdefines: shaderDefines,

        computeUniformBufferFormats: {
            ub: new pc.UniformBufferFormat(device, [
                new pc.UniformFormat('numTilesX', pc.UNIFORMTYPE_UINT),
                new pc.UniformFormat('numTilesY', pc.UNIFORMTYPE_UINT),
                new pc.UniformFormat('tintColor', pc.UNIFORMTYPE_VEC3)
            ])
        },

        computeBindGroupFormat: new pc.BindGroupFormat(device, [
            new pc.BindUniformBufferFormat('ub', pc.SHADERSTAGE_COMPUTE),
            new pc.BindStorageBufferFormat('tileList', pc.SHADERSTAGE_COMPUTE, true), // read-only
            new pc.BindTextureFormat(
                'inputTexture',
                pc.SHADERSTAGE_COMPUTE,
                pc.TEXTUREDIMENSION_2D,
                pc.SAMPLETYPE_FLOAT,
                false
            ), // no sampler, using textureload
            new pc.BindStorageTextureFormat('outputTexture', pc.PIXELFORMAT_RGBA8, pc.TEXTUREDIMENSION_2D)
        ])
    });

    // create compute instances
    scanCompute = new pc.Compute(device, scanShader, 'ScanCompute');
    effectComputeEdge = new pc.Compute(device, effectShader, 'EffectComputeEdge');
    effectComputeSmooth = new pc.Compute(device, effectShader, 'EffectComputeSmooth');

    // set initial data values
    data.set('data', {
        threshold: 15 // threshold is in world units - depth range within tile that triggers edge detection
    });

    // update loop
    app.on('update', (/** @type {number} */ dt) => {
        if (!device.supportsCompute || !scanCompute || !effectComputeEdge || !effectComputeSmooth) {
            return;
        }

        // get threshold from ui
        const threshold = data.get('data.threshold') ?? 0.02;

        // clear all counter buffers each frame
        edgeTileCounterBuffer.clear();
        smoothTileCounterBuffer.clear();
        completionCounterBuffer.clear();

        // allocate two slots in the indirect dispatch buffer for this frame
        const edgeIndirectSlot = device.getIndirectDispatchSlot();
        const smoothIndirectSlot = device.getIndirectDispatchSlot();

        // --- pass 1: scan tiles and classify by depth discontinuity ---
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

        // --- pass 2: apply red tint to edge tiles (indirect dispatch) ---
        effectComputeEdge.setParameter('numTilesX', numTilesX);
        effectComputeEdge.setParameter('numTilesY', numTilesY);
        effectComputeEdge.setParameter('tintColor', [1.0, 0.3, 0.3]);
        effectComputeEdge.setParameter('tileList', edgeTileListBuffer);
        effectComputeEdge.setParameter('inputTexture', renderTarget.colorBuffer);
        effectComputeEdge.setParameter('outputTexture', outputTexture);

        effectComputeEdge.setupIndirectDispatch(edgeIndirectSlot);
        device.computeDispatch([effectComputeEdge], 'EffectEdgeDispatch');

        // --- pass 3: apply blue tint to smooth tiles (indirect dispatch) ---
        effectComputeSmooth.setParameter('numTilesX', numTilesX);
        effectComputeSmooth.setParameter('numTilesY', numTilesY);
        effectComputeSmooth.setParameter('tintColor', [0.3, 0.3, 1.0]);
        effectComputeSmooth.setParameter('tileList', smoothTileListBuffer);
        effectComputeSmooth.setParameter('inputTexture', renderTarget.colorBuffer);
        effectComputeSmooth.setParameter('outputTexture', outputTexture);

        effectComputeSmooth.setupIndirectDispatch(smoothIndirectSlot);
        device.computeDispatch([effectComputeSmooth], 'EffectSmoothDispatch');

        // display textures with a small gap between them
        const gap = 0.02;

        // top half: original rt texture
        app.drawTexture(0, 0.5 - gap * 0.5, 2.0 - gap * 2, 1.0 - gap * 2, renderTarget.colorBuffer);

        // bottom half: compute-processed texture (red edge tiles, blue smooth tiles)
        app.drawTexture(0, -0.5 + gap * 0.5, 2.0 - gap * 2, 1.0 - gap * 2, outputTexture);
    });
}
