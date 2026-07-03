// @config
// @flag HIDDEN
//
// @credit
// title: Terrain Low Poly
// author: Sketchfab
// source: https://sketchfab.com/3d-models/terrain-low-poly-248b21331315466e98d20c441935d99d
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

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
    LightComponentSystem,
    Mat4,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderPassShaderQuad,
    RenderView,
    SEMANTIC_POSITION,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderUtils,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    terrain: new Asset('terrain', 'container', { url: './assets/models/terrain.glb' }),
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
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Composite pass that samples a 4-layer texture array and writes the layers into a 2x2 grid on
// the canvas backbuffer. Used by the WebGPU branch to visualise the per-eye renders produced by
// FramePassMultiView.
class CompositeArrayPass extends RenderPassShaderQuad {
    constructor(graphicsDevice, sourceTexture, numViews) {
        super(graphicsDevice);
        this.name = 'CompositeArrayPass';
        this.sourceTexture = sourceTexture;
        this.numViews = numViews;

        this.shader = ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'XrViewsCompositeShader',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',

            fragmentWGSL: /* wgsl */ `
                var sourceTexture: texture_2d_array<f32>;
                var sourceTextureSampler: sampler;
                varying uv0: vec2f;

                @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                    var output: FragmentOutput;
                    let q = floor(input.uv0 * 2.0);
                    // clamp layer: at uv edge (1,1) q can be 2, giving layer 4 for a 4-layer array
                    let layer = clamp(i32(q.x + q.y * 2.0), 0, 3);
                    let localUV = input.uv0 * 2.0 - q;
                    output.color = textureSample(sourceTexture, sourceTextureSampler, localUV, layer);
                    return output;
                }
            `
        });
    }

    // Called once per frame during frame graph construction, after frameStart() but before any
    // GPU commands are recorded. This is the safe point to resize the array texture: the previous
    // frame's GPU commands have already been submitted and deferred-destroys flushed, so
    // destroying the old GPU texture here won't conflict with any pending submit.
    frameUpdate() {
        super.frameUpdate();

        const tex = this.sourceTexture;
        if (!tex) return;

        // resize to match the current backbuffer dimensions
        const { width, height } = this.device.backBuffer;
        if (width > 0 && height > 0) {
            tex.resize(width, height);
        }

        // re-populate device.xrSubImages with the current (possibly new) GPU texture reference.
        // this must happen after resize() so the GPU texture handle is up-to-date.
        const gpuTexture = tex.impl?.gpuTexture;
        if (gpuTexture) {
            const viewFormat = gpuTexture.format;
            const subImages = [];
            for (let i = 0; i < this.numViews; i++) {
                subImages.push({
                    colorTexture: gpuTexture,
                    viewDescriptor: {
                        dimension: '2d',
                        baseArrayLayer: i,
                        arrayLayerCount: 1,
                        baseMipLevel: 0,
                        mipLevelCount: 1
                    },
                    viewport: { x: 0, y: 0, width, height },
                    viewFormat
                });
            }
            this.device.xrSubImages = subImages;
        }
    }

    execute() {
        this.device.scope.resolve('sourceTexture').setValue(this.sourceTexture);
        super.execute();
    }
}

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// setup skydome
app.scene.skyboxMip = 3;
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, -70, 0);

// instantiate the terrain
/** @type {Entity} */
const terrain = assets.terrain.resource.instantiateRenderEntity();
terrain.setLocalScale(30, 30, 30);
app.root.addChild(terrain);

// Create a directional light
const dirLight = new Entity('Cascaded Light');
dirLight.addComponent('light', {
    type: 'directional',
    color: Color.WHITE,
    shadowBias: 0.3,
    normalOffsetBias: 0.2,
    intensity: 1.0,
    castShadows: false,
    shadowDistance: 1000
});
app.root.addChild(dirLight);
dirLight.setLocalEulerAngles(75, 120, 20);

// create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.9, 0.9, 0.9),
    farClip: 1000,
    toneMapping: TONEMAP_ACES
});

// and position it in the world
camera.setLocalPosition(-500, 160, 300);

// add orbit camera script with a mouse and a touch support
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: terrain,
        distanceMax: 600
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Create mock XR views using a loop. The number of views differs between backends because
// each backend uses a different visualisation:
// - WebGL: a single canvas-sized backbuffer with 4 sub-rect viewports (2x2 grid).
// - WebGPU: a 4-layer array texture, one full-canvas-size view per layer, then composited
//   into a 2x2 grid as a separate post-render pass.
const numViews = 4;
const viewsList = [];
for (let i = 0; i < numViews; i++) {
    viewsList.push(new RenderView());
}

// simulate an active XR session by handing the camera the per-view array directly. On a real
// headset the XrManager populates xrViews (and the per-eye device projection); here we build
// each eye's projection from the camera's settings, captured before the session is activated
// (once active, the fov/clip getters report XR-session values instead).
const projFov = camera.camera.fov;
const projNearClip = camera.camera.nearClip;
const projFarClip = camera.camera.farClip;
const projHorizontalFov = camera.camera.horizontalFov;
camera.camera.camera.xrViews = viewsList;

// ----------------------------------------------------------------------------------------
// WebGPU-only setup: drive FramePassMultiView via a fake bridge - we provide the per-view
// sub-image entries on the device that the wrapper consumes (mirroring what
// WebgpuXrBridge.beginFrame does on a real headset).
// ----------------------------------------------------------------------------------------
let arrayTex = null;
let compositeCamera = null;
if (device.isWebGPU) {
    const createArrayTexture = (w, h) =>
        new Texture(device, {
            name: 'XrViewsArrayTexture',
            format: device.backBufferFormat,
            arrayLength: numViews,
            width: w,
            height: h,
            mipmaps: false,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR
        });

    arrayTex = createArrayTexture(Math.max(canvas.width, 1), Math.max(canvas.height, 1));

    // composite camera renders second (higher priority) and only runs the composite pass that
    // samples the four rendered layers and lays them out as a 2x2 grid on the canvas
    compositeCamera = new Entity('XrViewsCompositeCamera');
    compositeCamera.addComponent('camera', {
        priority: 1,
        clearColor: new Color(0, 0, 0, 0),
        clearColorBuffer: false,
        clearDepthBuffer: false,
        clearStencilBuffer: false
    });
    app.root.addChild(compositeCamera);

    const compositePass = new CompositeArrayPass(device, arrayTex, numViews);
    compositePass.init(null);
    compositeCamera.camera.framePasses = [compositePass];
}

// reused each frame; setView/setViewport copy the data into each view
const projMat = new Mat4();
const viewInvMat = new Mat4();

app.on('update', (/** @type {number} */ _dt) => {
    const width = canvas.width;
    const height = canvas.height;
    const isWebgpu = device.isWebGPU;

    // all views share the projection; the renderer derives the per-view matrices from setView
    projMat.setPerspective(projFov, width / height, projNearClip, projFarClip, projHorizontalFov);

    // update all views - supply projection, pose and viewport for each
    viewsList.forEach((view, viewIndex) => {
        const pos = camera.getPosition();
        const rot = camera.getRotation();

        // Rotate each view by 10 degrees * view index around UP axis
        const angle = 10 * viewIndex;
        const upRotation = new Quat().setFromAxisAngle(Vec3.UP, angle);
        const combinedRot = new Quat().mul2(upRotation, rot);
        viewInvMat.setTRS(pos, combinedRot, Vec3.ONE);

        // supply the view's projection and pose; the renderer derives the rest each frame
        view.setView(projMat.data, viewInvMat.data);

        if (isWebgpu) {
            // each view writes into its own array layer at full size; the composite pass
            // arranges the four layers into a 2x2 grid on the canvas
            view.setViewport(0, 0, width, height);
        } else {
            // WebGL: 4 sub-viewports of a single canvas-sized backbuffer (2x2 grid).
            // WebGL viewport y=0 is the bottom of the canvas, so views 0,1 go in the top
            // row (y = height/2) to match the WebGPU composite's top-down layout.
            view.setViewport(
                viewIndex % 2 === 0 ? 0 : width / 2,
                viewIndex < 2 ? height / 2 : 0,
                width / 2,
                height / 2
            );
        }
    });
});
