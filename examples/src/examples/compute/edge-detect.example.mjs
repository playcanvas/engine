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

import * as pc from 'playcanvas';

import { deviceType } from 'examples/context';

import computeShaderWgsl from './compute-shader.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const assets = {
    board: new pc.Asset('board', 'container', { url: './assets/models/chess-board.glb' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

let renderTarget = null;
let rtCamera = null;
let computeShader = null;
let compute = null;
let storageTexture = null;
let rtWidth = 0;
let rtHeight = 0;

// ensure canvas is resized when window changes size
const resize = () => {
    app.resizeCanvas();

    // resize render target and storage texture to match new screen size
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

// create a layer for the render target
const rtLayer = new pc.Layer({ name: 'RTLayer' });
app.scene.layers.push(rtLayer);

// load assets and create the scene
await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// set up environment lighting
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;

// create a directional light
const light = new pc.Entity('light');
light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 1, 1),
    intensity: 1
});
light.setEulerAngles(45, 45, 0);
app.root.addChild(light);

// create main camera (for final view)
const mainCamera = new pc.Entity('mainCamera');
mainCamera.addComponent('camera', {
    clearColor: new pc.Color(0.2, 0.2, 0.3)
});
mainCamera.setPosition(0, 0, 0);
app.root.addChild(mainCamera);

// create the render target with msaa support
const createRenderTarget = (useMsaa) => {
    // use screen dimensions (half height for each texture)
    rtWidth = device.width;
    rtHeight = Math.floor(device.height / 2);

    // create a single-sample texture that will receive the resolved result
    const texture = new pc.Texture(device, {
        name: 'RT-Texture',
        width: rtWidth,
        height: rtHeight,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    // create render target with optional msaa
    // when samples > 1, playcanvas creates internal msaa buffers and resolves to the colorbuffer
    const rt = new pc.RenderTarget({
        name: 'MSAA-RT',
        colorBuffer: texture,
        depth: true,
        samples: useMsaa ? 4 : 1
    });

    return rt;
};

// create storage texture for compute output
const createStorageTexture = () => {
    return new pc.Texture(device, {
        name: 'Storage-Texture',
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
};

// create the compute shader
const createComputeShader = () => {
    if (!device.supportsCompute) return null;

    // no computebindgroupformat is provided - the input texture (+ sampler) and the output
    // storage texture use the simplified wgsl syntax and are reflected automatically by the
    // engine from the shader source.
    return new pc.Shader(device, {
        name: 'EdgeDetect-Shader',
        shaderLanguage: pc.SHADERLANGUAGE_WGSL,
        cshader: computeShaderWgsl
    });
};

// create camera that renders to the render target
let cameraAngle = 0;
const createRTCamera = (rt) => {
    const cam = new pc.Entity('rtCamera');
    cam.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1),
        renderTarget: rt,
        farClip: 500,
        layers: [rtLayer.id]
    });
    // position like in multi-view example
    cam.setLocalPosition(100, 35, 0);
    cam.lookAt(pc.Vec3.ZERO);
    app.root.addChild(cam);
    return cam;
};

// create the chess board entity - only render in rt layer
const boardEntity = assets.board.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true,
    layers: [rtLayer.id]
});
app.root.addChild(boardEntity);

// create the compute shader (only once)
computeShader = createComputeShader();

// create resources with msaa enabled
renderTarget = createRenderTarget(true);
rtCamera = createRTCamera(renderTarget);
storageTexture = createStorageTexture();

// create compute instance if supported
if (device.supportsCompute && computeShader) {
    compute = new pc.Compute(device, computeShader, 'EdgeDetect');

    // set up the compute parameters
    // note: sampler is automatically handled by playcanvas when hassampler: true
    compute.setParameter('inputTexture', renderTarget.colorBuffer);
    compute.setParameter('outputTexture', storageTexture);
}

// update loop
let time = 0;
app.on('update', (dt) => {
    time += dt;

    // orbit camera around the scene
    if (rtCamera) {
        cameraAngle = time * 0.2;
        rtCamera.setLocalPosition(100 * Math.sin(cameraAngle), 35, 100 * Math.cos(cameraAngle));
        rtCamera.lookAt(pc.Vec3.ZERO);
    }

    if (device.supportsCompute && compute && renderTarget) {
        // set up dispatch dimensions (workgroup size is 8x8 in shader)
        const workgroupsX = Math.ceil(rtWidth / 8);
        const workgroupsY = Math.ceil(rtHeight / 8);
        compute.setupDispatch(workgroupsX, workgroupsY, 1);

        // dispatch the compute shader
        device.computeDispatch([compute], 'EdgeDetect-Dispatch');

        const gap = 0.02;

        // top half: original rt texture
        app.drawTexture(0, 0.5 - gap * 0.5, 2.0 - gap * 2, 1.0 - gap * 2, renderTarget.colorBuffer);

        // bottom half: compute-processed texture
        app.drawTexture(0, -0.5 + gap * 0.5, 2.0 - gap * 2, 1.0 - gap * 2, storageTexture);
    }
});
