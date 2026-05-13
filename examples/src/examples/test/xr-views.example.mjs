// @config HIDDEN
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    terrain: new pc.Asset('terrain', 'container', { url: `${rootPath}/static/assets/models/terrain.glb` }),
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
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Composite pass that samples a 4-layer texture array and writes the layers into a 2x2 grid on
// the canvas backbuffer. Used by the WebGPU branch to visualise the per-eye renders produced by
// FramePassMultiView.
class CompositeArrayPass extends pc.RenderPassShaderQuad {
    constructor(graphicsDevice, sourceTexture, numViews) {
        super(graphicsDevice);
        this.name = 'CompositeArrayPass';
        this.sourceTexture = sourceTexture;
        this.numViews = numViews;

        this.shader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'XrViewsCompositeShader',
            attributes: { aPosition: pc.SEMANTIC_POSITION },
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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    // setup skydome
    app.scene.skyboxMip = 3;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -70, 0);

    // instantiate the terrain
    /** @type {pc.Entity} */
    const terrain = assets.terrain.resource.instantiateRenderEntity();
    terrain.setLocalScale(30, 30, 30);
    app.root.addChild(terrain);

    // Create a directional light
    const dirLight = new pc.Entity('Cascaded Light');
    dirLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        shadowBias: 0.3,
        normalOffsetBias: 0.2,
        intensity: 1.0,
        castShadows: false,
        shadowDistance: 1000
    });
    app.root.addChild(dirLight);
    dirLight.setLocalEulerAngles(75, 120, 20);

    // create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.9, 0.9, 0.9),
        farClip: 1000,
        toneMapping: pc.TONEMAP_ACES
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
        viewsList.push({
            updateTransforms(transform) {
            },
            viewport: new pc.Vec4(),
            projMat: new pc.Mat4(),
            viewOffMat: new pc.Mat4(),
            viewInvOffMat: new pc.Mat4(),
            viewMat3: new pc.Mat3(),
            projViewOffMat: new pc.Mat4(),
            viewInvMat: new pc.Mat4(),
            positionData: [0, 0, 0],
            viewIndex: i
        });
    }

    camera.camera.camera.xr = {
        session: true,
        views: {
            list: viewsList
        }
    };

    // ----------------------------------------------------------------------------------------
    // WebGPU-only setup: drive FramePassMultiView via a fake bridge - we provide the per-view
    // sub-image entries on the device that the wrapper consumes (mirroring what
    // WebgpuXrBridge.beginFrame does on a real headset).
    // ----------------------------------------------------------------------------------------
    let arrayTex = null;
    let compositeCamera = null;
    if (device.isWebGPU) {

        const createArrayTexture = (w, h) => new pc.Texture(device, {
            name: 'XrViewsArrayTexture',
            format: device.backBufferFormat,
            arrayLength: numViews,
            width: w,
            height: h,
            mipmaps: false,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR
        });

        arrayTex = createArrayTexture(Math.max(canvas.width, 1), Math.max(canvas.height, 1));

        // composite camera renders second (higher priority) and only runs the composite pass that
        // samples the four rendered layers and lays them out as a 2x2 grid on the canvas
        compositeCamera = new pc.Entity('XrViewsCompositeCamera');
        compositeCamera.addComponent('camera', {
            priority: 1,
            clearColor: new pc.Color(0, 0, 0, 0),
            clearColorBuffer: false,
            clearDepthBuffer: false,
            clearStencilBuffer: false
        });
        app.root.addChild(compositeCamera);

        const compositePass = new CompositeArrayPass(device, arrayTex, numViews);
        compositePass.init(null);
        compositeCamera.camera.framePasses = [compositePass];
    }

    const cameraComponent = camera.camera;
    app.on('update', (/** @type {number} */ dt) => {

        const width = canvas.width;
        const height = canvas.height;
        const isWebgpu = device.isWebGPU;

        // update all views - supply some matrices to make pre view rendering possible
        // note that this is not complete set up, view frustum does not get updated and so
        // culling does not work well
        viewsList.forEach((/** @type {XrView} */ view) => {
            view.projMat.copy(cameraComponent.projectionMatrix);

            const pos = camera.getPosition();
            const rot = camera.getRotation();

            const viewInvMat = new pc.Mat4();

            // Rotate each view by 10 degrees * view index around UP axis
            const angle = 10 * view.viewIndex;
            const upRotation = new pc.Quat().setFromAxisAngle(pc.Vec3.UP, angle);
            const combinedRot = new pc.Quat().mul2(upRotation, rot);
            viewInvMat.setTRS(pos, combinedRot, pc.Vec3.ONE);

            const viewMat = new pc.Mat4();
            viewMat.copy(viewInvMat).invert();

            view.viewMat3.setFromMat4(viewMat);

            view.projViewOffMat.mul2(view.projMat, viewMat);

            const viewport = view.viewport;
            if (isWebgpu) {
                // each view writes into its own array layer at full size; the composite pass
                // arranges the four layers into a 2x2 grid on the canvas
                viewport.x = 0;
                viewport.y = 0;
                viewport.z = width;
                viewport.w = height;
            } else {
                // WebGL: 4 sub-viewports of a single canvas-sized backbuffer (2x2 grid).
                // WebGL viewport y=0 is the bottom of the canvas, so views 0,1 go in the top
                // row (y = height/2) to match the WebGPU composite's top-down layout.
                viewport.x = (view.viewIndex % 2 === 0) ? 0 : width / 2;
                viewport.y = (view.viewIndex < 2) ? height / 2 : 0;
                viewport.z = width / 2;
                viewport.w = height / 2;
            }
        });

    });
});

export { app };
