// @config
//
// A compute shader reads the scene depth and color maps to draw a scanner pulse sweeping through
// the scene.
//
// @flag WEBGL_DISABLED
//
// @credit
// title: Laboratory
// author: Sketchfab
// source: https://sketchfab.com/3d-models/laboratory-e860e49837c044478db650868866a448
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    ADDRESS_CLAMP_TO_EDGE,
    AnimComponentSystem,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_ADDITIVE,
    BoundingBox,
    CULLFACE_NONE,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Compute,
    ContainerHandler,
    DepthState,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    Layer,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_WGSL,
    ScriptComponentSystem,
    ScriptHandler,
    Shader,
    ShaderMaterial,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec3,
    WasmModule,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

import scannerWgsl from './scanner.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    laboratory: new Asset('laboratory', 'container', { url: './assets/models/laboratory.glb' }),
    bitmoji: new Asset('bitmoji', 'container', { url: './assets/models/bitmoji.glb' }),
    walk: new Asset('walk', 'container', { url: './assets/animations/bitmoji/walk.glb' }),
    orbit: new Asset('orbit', 'script', { url: './scripts/camera/orbit-camera.js' }),
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
    ScriptComponentSystem,
    AnimComponentSystem
];
createOptions.resourceHandlers = [ScriptHandler, TextureHandler, ContainerHandler];

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

// Setup skydome
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 2.5;

// ------ The scene ------

const laboratoryEntity = assets.laboratory.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
laboratoryEntity.setLocalScale(100, 100, 100);
app.root.addChild(laboratoryEntity);

// Warm lights at the torches of the laboratory
const torches = laboratoryEntity.find((node) => node.name.indexOf('Fackel') !== -1);
torches.forEach((torch) => {
    const light = new Entity('Torch');
    light.addComponent('light', {
        type: 'omni',
        color: new Color(1, 0.75, 0),
        intensity: 3,
        range: 100
    });
    light.setLocalPosition(torch.children[0].render.meshInstances[0].aabb.center);
    app.root.addChild(light);
});

const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.2, 0.2, 0.2);
groundMaterial.update();

const ground = new Entity('Ground');
ground.addComponent('render', { type: 'plane', material: groundMaterial });
ground.setLocalScale(new Vec3(400, 1, 400));
ground.setLocalPosition(0, -40, 0);
app.root.addChild(ground);

const sun = new Entity('Sun');
sun.addComponent('light', {
    type: 'directional',
    intensity: 1,
    castShadows: true,
    shadowResolution: 2048,
    shadowBias: 0.4,
    normalOffsetBias: 0.06,
    shadowDistance: 600
});
sun.setLocalEulerAngles(35, 30, 0);
app.root.addChild(sun);

// The pulse is emitted from the floor in the middle of the laboratory, and travels past its walls
const bounds = new BoundingBox();
laboratoryEntity.findComponents('render').forEach((render, index) => {
    render.meshInstances.forEach((meshInstance, i) => {
        if (index === 0 && i === 0) {
            bounds.copy(meshInstance.aabb);
        } else {
            bounds.add(meshInstance.aabb);
        }
    });
});
const origin = new Vec3(bounds.center.x, bounds.getMin().y, bounds.center.z);
const maxRadius = bounds.halfExtents.length() * 2.5;

// Characters walking around the laboratory in both directions. They render into the scene maps
// like the rest of the scene, so the pulse sweeps over them as they move.
const walkers = [];
const walkerCount = 8;
const walkerHeight = ground.getPosition().y;
for (let i = 0; i < walkerCount; i++) {
    const walker = assets.bitmoji.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    });
    walker.setLocalScale(20, 20, 20);
    walker.addComponent('anim', { activate: true, speed: 0.9 + (i % 3) * 0.1 });
    walker.anim.assignAnimation('Walk', assets.walk.resource.animations[0].resource);
    app.root.addChild(walker);

    walkers.push({
        entity: walker,
        angle: (i / walkerCount) * Math.PI * 2,
        direction: i % 2 ? 1 : -1,
        radius: 125 + (i % 2) * 20
    });
}

const cameraEntity = new Entity('Camera');
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    nearClip: 1,
    farClip: 600,
    toneMapping: TONEMAP_NEUTRAL
});
cameraEntity.addComponent('script');
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: laboratoryEntity,
        distanceMax: 350
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');
cameraEntity.setLocalPosition(-60, 30, 60);
app.root.addChild(cameraEntity);

// The camera renders its scene maps either with the forward renderer, which renders them on request,
// or with a camera frame, which renders them when configured to
const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.rendering.sceneColorMap = true;

// ------ The scanner ------

// A compute shader reconstructing the world position of each pixel from the scene depth map, and
// drawing the scanner pulse into an overlay texture, tinted by the scene color map. Its uniforms and
// resources use the simplified WGSL syntax, and are reflected automatically.
const shader = new Shader(device, {
    name: 'Scanner',
    shaderLanguage: SHADERLANGUAGE_WGSL,
    cshader: scannerWgsl
});
const compute = new Compute(device, shader, 'Scanner');

// The scene maps of the camera are attached once - each dispatch then reads the maps the camera
// rendered most recently, decoded however the camera stored them
compute.setSceneDepthMap(cameraEntity.camera.sceneDepthMapHandle);
compute.setSceneColorMap(cameraEntity.camera.sceneColorMapHandle);

// The overlay is added over the final image by a camera rendering after the main one, so that it
// is drawn the same way whether the main camera uses the camera frame or not
const overlayLayer = new Layer({ name: 'ScannerOverlay' });
app.scene.layers.push(overlayLayer);

const overlayMaterial = new ShaderMaterial({
    uniqueName: 'ScannerOverlay',
    vertexWGSL: /* wgsl */ `
        attribute aPosition: vec3f;
        varying vUv: vec2f;

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;

            // the plane spans -0.5 to 0.5 on the x and z axes, stretched over the whole screen
            output.position = vec4f(input.aPosition.x * 2.0, -input.aPosition.z * 2.0, 0.0, 1.0);
            output.vUv = input.aPosition.xz + 0.5;
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */ `
        var overlayTexture: texture_2d<f32>;
        var overlayTexture_sampler: sampler;
        varying vUv: vec2f;

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            output.color = textureSample(overlayTexture, overlayTexture_sampler, input.vUv);
            return output;
        }
    `,
    attributes: { aPosition: SEMANTIC_POSITION }
});
overlayMaterial.blendType = BLEND_ADDITIVE;
overlayMaterial.depthState = DepthState.NODEPTH;
overlayMaterial.cull = CULLFACE_NONE;
overlayMaterial.update();

const overlayQuad = new Entity('ScannerOverlay');
overlayQuad.addComponent('render', { type: 'plane', material: overlayMaterial, layers: [overlayLayer.id] });
overlayQuad.render.meshInstances[0].cull = false;
app.root.addChild(overlayQuad);

const overlayCamera = new Entity('OverlayCamera');
overlayCamera.addComponent('camera', {
    clearColorBuffer: false,
    clearDepthBuffer: false,
    clearStencilBuffer: false,
    priority: 1,
    layers: [overlayLayer.id]
});
app.root.addChild(overlayCamera);

// The overlay is rendered at half the resolution of the screen, and upscaled when drawn
/** @type {Texture|null} */
let overlayTexture = null;
const updateOverlayTexture = () => {
    const width = Math.max(1, Math.floor(device.width / 2));
    const height = Math.max(1, Math.floor(device.height / 2));
    if (overlayTexture?.width !== width || overlayTexture?.height !== height) {
        overlayTexture?.destroy();
        overlayTexture = new Texture(device, {
            name: 'ScannerOverlay',
            width,
            height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            storage: true
        });
        compute.setParameter('overlay', overlayTexture);
        overlayMaterial.setParameter('overlayTexture', overlayTexture);
    }
};
updateOverlayTexture();

// ------ The way the camera renders its scene maps ------

let mapsRequested = false;
const applyRendering = () => {
    const forward = data.get('data.renderer') === 'forward';

    // the forward renderer renders the scene maps on request: the depth by copying the depth buffer
    // values, and the color gamma encoded
    if (forward !== mapsRequested) {
        cameraEntity.camera.requestSceneDepthMap(forward);
        cameraEntity.camera.requestSceneColorMap(forward);
        mapsRequested = forward;
    }

    // the camera frame renders the scene color linear. It renders the depth in a prepass when asked
    // for the depth map, and as part of the scene pass when an effect after it needs the depth, here
    // TAA - except with multi-sampling, which the depth of the scene pass does not support
    cameraFrame.enabled = !forward;
    const scenePassDepth = data.get('data.depthSource') === 'scenePass';
    cameraFrame.rendering.sceneDepthMap = !scenePassDepth;
    cameraFrame.taa.enabled = scenePassDepth;
    cameraFrame.rendering.samples = data.get('data.msaa') ? 4 : 1;
    cameraFrame.rendering.renderFormats = [data.get('data.renderFormat')];
    cameraFrame.update();
};

data.set('data', {
    renderer: 'forward',
    depthSource: 'prepass',
    msaa: true,
    renderFormat: PIXELFORMAT_RGBA16F,
    speed: 60,
    bandWidth: 3,
    gridSize: 2
});

applyRendering();
data.on('*:set', (/** @type {string} */ path) => {
    if (
        path === 'data.renderer' ||
        path === 'data.depthSource' ||
        path === 'data.msaa' ||
        path === 'data.renderFormat'
    ) {
        applyRendering();
    }
});

// ------ Update ------

const scanColor = [0.2, 0.75, 1];
let time = 0;
let firstFrame = true;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // the scene maps are rendered for the first time as the first frame renders, so there is
    // nothing to scan before that
    if (firstFrame) {
        firstFrame = false;
        return;
    }

    updateOverlayTexture();

    // the pulse expands from the origin, and is emitted again once it has passed the laboratory
    const speed = data.get('data.speed');
    const radius = (time * speed) % maxRadius;

    compute.setParameter('origin', [origin.x, origin.y, origin.z]);
    compute.setParameter('radius', radius);
    compute.setParameter('bandWidth', data.get('data.bandWidth'));
    compute.setParameter('trailLength', maxRadius * 0.15);
    compute.setParameter('gridSize', data.get('data.gridSize'));
    compute.setParameter('scanColor', scanColor);

    // the world size of an overlay pixel one unit from the camera, to keep the grid lines visible
    const fov = cameraEntity.camera.fov * math.DEG_TO_RAD;
    compute.setParameter('pixelSize', (2 * Math.tan(fov * 0.5)) / overlayTexture.height);

    // This runs before the frame renders, so it uses the scene maps of the previous frame. The
    // overlay trails the scene by a frame while the camera moves.
    compute.setupDispatch(Math.ceil(overlayTexture.width / 8), Math.ceil(overlayTexture.height / 8));
    device.computeDispatch([compute], 'ScannerDispatch');
});

const walkerPosition = new Vec3();
const walkerTarget = new Vec3();
app.on('update', (/** @type {number} */ dt) => {
    walkers.forEach((walker) => {
        // walk along a circle around the laboratory, at a speed roughly matching the animation
        const angularSpeed = (14 * walker.entity.anim.speed) / walker.radius;
        walker.angle += walker.direction * angularSpeed * dt;
        walkerPosition.set(
            origin.x + Math.sin(walker.angle) * walker.radius,
            walkerHeight,
            origin.z + Math.cos(walker.angle) * walker.radius
        );
        walker.entity.setPosition(walkerPosition);

        // the model faces +Z, and lookAt points -Z at the target, so look at the point behind
        const behind = walker.angle - walker.direction * 0.1;
        walkerTarget.set(
            origin.x + Math.sin(behind) * walker.radius,
            walkerPosition.y,
            origin.z + Math.cos(behind) * walker.radius
        );
        walker.entity.lookAt(walkerTarget);
    });
});

export { app };
