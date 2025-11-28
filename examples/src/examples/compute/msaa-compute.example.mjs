// @config WEBGL_DISABLED
import files from 'examples/files';
import { data } from 'examples/observer';
import { deviceType } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// A helper script that rotates the entity
const Rotator = pc.createScript('rotator');
Rotator.prototype.update = function (/** @type {number} */ dt) {
    this.entity.rotate(10 * dt, 20 * dt, 30 * dt);
};

const RT_SIZE = 32;
let renderTarget = null;
let rtCamera = null;
let computeShader = null;
let compute = null;
let storageTexture = null;

// Create a simple spinning cube scene
const createCube = () => {
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(1, 0.5, 0.2);
    material.update();

    const cube = new pc.Entity('cube');
    cube.addComponent('render', {
        type: 'box',
        material: material
    });
    cube.addComponent('script');
    cube.script.create('rotator');
    cube.setLocalScale(1.5, 1.5, 1.5);
    app.root.addChild(cube);

    return cube;
};

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
    // Create a single-sample texture that will receive the resolved result
    const texture = new pc.Texture(device, {
        name: 'RT-Texture',
        width: RT_SIZE,
        height: RT_SIZE,
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
        width: RT_SIZE,
        height: RT_SIZE,
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
        name: 'MSAA-Compute-Shader',
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
const createRTCamera = (rt) => {
    const cam = new pc.Entity('rtCamera');
    cam.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1),
        renderTarget: rt
    });
    cam.setPosition(0, 0, 5);
    app.root.addChild(cam);
    return cam;
};

// Initialize the scene
const initScene = (useMsaa) => {
    // Clean up previous resources
    if (rtCamera) {
        rtCamera.destroy();
        rtCamera = null;
    }
    if (renderTarget) {
        renderTarget.destroy();
        renderTarget = null;
    }
    if (storageTexture) {
        storageTexture.destroy();
        storageTexture = null;
    }
    // Note: Compute instances don't have a destroy method
    compute = null;

    // Create new resources
    renderTarget = createRenderTarget(useMsaa);
    rtCamera = createRTCamera(renderTarget);
    storageTexture = createStorageTexture();

    // Create compute instance if supported
    if (device.supportsCompute && computeShader) {
        compute = new pc.Compute(device, computeShader, 'MSAA-Compute');

        // Set up the compute parameters
        // Note: sampler is automatically handled by PlayCanvas when hasSampler: true
        compute.setParameter('inputTexture', renderTarget.colorBuffer);
        compute.setParameter('outputTexture', storageTexture);
    }
};

// Create the cube and compute shader (only once)
createCube();
computeShader = createComputeShader();

// Set up everything before app starts
app.once('start', () => {
    // Listen for MSAA toggle changes
    data.on('msaaEnabled:set', (value) => {
        initScene(value);
    });

    // Initialize with MSAA enabled (this will trigger the listener)
    data.set('msaaEnabled', true);
});

// Defer app.start() to next tick to allow loader to register its listener first
setTimeout(() => {
    app.start();
}, 0);

// Update loop
app.on('update', () => {
    if (device.supportsCompute && compute && renderTarget) {
        // Set up dispatch dimensions (workgroup size is 8x8 in shader)
        const workgroupsX = Math.ceil(RT_SIZE / 8);
        const workgroupsY = Math.ceil(RT_SIZE / 8);
        compute.setupDispatch(workgroupsX, workgroupsY, 1);

        // Dispatch the compute shader
        device.computeDispatch([compute], 'MSAA-Compute-Dispatch');

        // Display both textures side by side at 2x size
        // Left: original RT texture
        app.drawTexture(-0.5, 0, 0.8, 0.8, renderTarget.colorBuffer);

        // Right: compute-processed texture (with R/B swapped)
        app.drawTexture(0.5, 0, 0.8, 0.8, storageTexture);
    }
});

export { app };
