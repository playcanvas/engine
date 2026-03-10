// @config DESCRIPTION A compute shader reads from a render target texture, applies edge detection and highlights edges in red.
// @config WEBGL_DISABLED
import files from 'examples/files';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: `${rootPath}/static/lib/draco/draco.wasm.js`,
    wasmUrl: `${rootPath}/static/lib/draco/draco.wasm.wasm`,
    fallbackUrl: `${rootPath}/static/lib/draco/draco.js`
});

await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const assets = {
    board: new pc.Asset('board', 'container', { url: `${rootPath}/static/assets/models/chess-board.glb` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
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

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

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
const rtLayer = new pc.Layer({ name: 'RTLayer' });
app.scene.layers.push(rtLayer);

// Load assets and create the scene
const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Set up environment lighting
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxMip = 1;

    // Create a directional light
    const light = new pc.Entity('light');
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
        intensity: 1
    });
    light.setEulerAngles(45, 45, 0);
    app.root.addChild(light);

    // Create main camera (for final view)
    const mainCamera = new pc.Entity('mainCamera');
    mainCamera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.3)
    });
    mainCamera.setPosition(0, 0, 0);
    app.root.addChild(mainCamera);

    // Create the render target with MSAA support
    const createRenderTarget = (useMsaa) => {
        // Use screen dimensions (half height for each texture)
        rtWidth = device.width;
        rtHeight = Math.floor(device.height / 2);

        // Create a single-sample texture that will receive the resolved result
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

        // Create render target with optional MSAA
        // When samples > 1, PlayCanvas creates internal MSAA buffers and resolves to the colorBuffer
        const rt = new pc.RenderTarget({
            name: 'MSAA-RT',
            colorBuffer: texture,
            depth: true,
            samples: useMsaa ? 4 : 1
        });

        return rt;
    };

    // Create storage texture for compute output
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

    // Create the compute shader
    const createComputeShader = () => {
        if (!device.supportsCompute) return null;

        return new pc.Shader(device, {
            name: 'EdgeDetect-Shader',
            shaderLanguage: pc.SHADERLANGUAGE_WGSL,
            cshader: files['compute-shader.wgsl'],

            // Format of a bind group for the compute shader
            computeBindGroupFormat: new pc.BindGroupFormat(device, [
                // Input texture with sampler (sampler takes binding slot+1 automatically)
                new pc.BindTextureFormat('inputTexture', pc.SHADERSTAGE_COMPUTE, undefined, undefined, true),
                // Output storage texture
                new pc.BindStorageTextureFormat('outputTexture', pc.PIXELFORMAT_RGBA8, pc.TEXTUREDIMENSION_2D)
            ])
        });
    };

    // Create camera that renders to the render target
    let cameraAngle = 0;
    const createRTCamera = (rt) => {
        const cam = new pc.Entity('rtCamera');
        cam.addComponent('camera', {
            clearColor: new pc.Color(1, 1, 1),
            renderTarget: rt,
            farClip: 500,
            layers: [rtLayer.id]
        });
        // Position like in multi-view example
        cam.setLocalPosition(100, 35, 0);
        cam.lookAt(pc.Vec3.ZERO);
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
        compute = new pc.Compute(device, computeShader, 'EdgeDetect');

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
            rtCamera.lookAt(pc.Vec3.ZERO);
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
});

export { app };
