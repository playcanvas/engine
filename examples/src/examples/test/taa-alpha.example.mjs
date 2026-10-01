// @config
// @flag HIDDEN

// Temporary repro: TAA + transparent clear — RT alpha should stay 0 in empty regions when correct.
// Dev sidebar: test / taa-alpha

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLEND_NORMAL,
    CULLFACE_NONE,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    GraphNode,
    Layer,
    LightComponentSystem,
    Mesh,
    MeshInstance,
    Mouse,
    PIXELFORMAT_RGBA8,
    PRIMITIVE_TRISTRIP,
    RENDERTARGET_ORIGIN_TOP,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    SEMANTIC_POSITION,
    ScriptComponentSystem,
    ScriptHandler,
    ShaderMaterial,
    StandardMaterial,
    TONEMAP_ACES,
    Texture,
    TextureHandler,
    TextureRenderer,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

/**
 * @import { Material } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
};

const vertGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    uniform mat4 matrix_model;
    varying vec2 uv0;
    void main(void) {
        gl_Position = matrix_model * vec4(vertex_position.xy, 0, 1);
        uv0 = vertex_position.xy + 0.5;
    }
`;

const vertWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    uniform matrix_model: mat4x4f;
    varying uv0: vec2f;
    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniform.matrix_model * vec4f(input.vertex_position.xy, 0.0, 1.0);
        output.uv0 = input.vertex_position.xy + vec2f(0.5);
        return output;
    }
`;

// Preserve alpha so the composite panel tests blending over the display camera's clear color.
const fragCompositeGLSL = /* glsl */ `
    varying vec2 uv0;
    uniform sampler2D colorMap;
    void main(void) {
        gl_FragColor = texture2D(colorMap, uv0);
    }
`;

const fragCompositeWGSL = /* wgsl */ `
    varying uv0: vec2f;
    var colorMap: texture_2d<f32>;
    var colorMapSampler: sampler;
    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        output.color = textureSample(colorMap, colorMapSampler, input.uv0);
        return output;
    }
`;

const gfxOptions = {
    deviceTypes: [deviceType],
    antialias: false,
    alpha: true
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
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

const textures = new TextureRenderer(app);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

const worldLayer = app.scene.layers.getLayerByName('World');
const skyboxLayer = app.scene.layers.getLayerByName('Skybox');
const uiLayer = app.scene.layers.getLayerByName('UI');

const rtLayer = new Layer({ name: 'TaaAlphaReproRT' });
app.scene.layers.insert(rtLayer, 1);

const cubeMaterial = new StandardMaterial();
cubeMaterial.diffuse = new Color(0.52, 0.52, 0.52);
cubeMaterial.gloss = 0.5;
cubeMaterial.metalness = 0.35;
cubeMaterial.useMetalness = true;
cubeMaterial.update();

/**
 * @param {string} primitiveType - Primitive mesh type (e.g. `'box'`).
 * @param {Vec3} position - World-space position for the new entity.
 * @param {Vec3} scale - Local scale of the primitive.
 * @param {Material} mat - Material assigned to the render component.
 * @returns {Entity} The created entity (already parented under `app.root`).
 */
function createPrimitive(primitiveType, position, scale, mat) {
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        castShadows: true,
        material: mat,
        layers: [rtLayer.id]
    });
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);
    return primitive;
}

const orbitFocus = new Entity('OrbitFocus');
orbitFocus.setLocalPosition(0, 35, 0);
app.root.addChild(orbitFocus);

const numTowers = 8;
for (let i = 0; i < numTowers; i++) {
    let scale = 12;
    const fraction = (i / numTowers) * Math.PI * 2;
    const radius = 200;
    const numCubes = 12;
    for (let y = 0; y <= 10; y++) {
        const elevationRadius = radius * (1 - y / numCubes);
        const pos = new Vec3(elevationRadius * Math.sin(fraction), y * 6, elevationRadius * Math.cos(fraction));
        const prim = createPrimitive('box', pos, new Vec3(scale, scale, scale), cubeMaterial);
        prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
    }
    scale -= 1.5;
}

const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    intensity: 1.2,
    castShadows: true,
    shadowDistance: 800,
    shadowResolution: 2048,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    // Default light.layers is [World] only; geometry lives on rtLayer, so it would stay black.
    layers: [rtLayer.id]
});
app.root.addChild(light);
light.setLocalEulerAngles(50, 30, 0);

app.scene.ambientLight = new Color(0.25, 0.25, 0.28);

const sceneColorTex = new Texture(device, {
    name: 'TaaAlphaReproSceneColor',
    width: 4,
    height: 4,
    format: PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE
});

const sceneRt = new RenderTarget({
    name: 'TaaAlphaReproRT',
    colorBuffer: sceneColorTex,
    depth: true,
    origin: RENDERTARGET_ORIGIN_TOP,
    samples: 1
});

const sceneCamera = new Entity('SceneCamera');
sceneCamera.addComponent('camera', {
    layers: [rtLayer.id],
    farClip: 2000,
    nearClip: 0.5,
    priority: -1,
    renderTarget: sceneRt,
    // Fully transparent clear — green is visible only where alpha is preserved
    clearColor: new Color(0, 1, 0, 0)
});
app.root.addChild(sceneCamera);
sceneCamera.setLocalPosition(300 * Math.sin(0.3), 150, 300 * Math.cos(0.3));

sceneCamera.addComponent('script');
sceneCamera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: orbitFocus,
        distanceMax: 1200,
        frameOnStart: false
    }
});
sceneCamera.script.create('orbitCameraInputMouse');
sceneCamera.script.create('orbitCameraInputTouch');

const cameraFrame = new CameraFrame(app, sceneCamera.camera);
cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA8];
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.rendering.samples = 1;
cameraFrame.bloom.intensity = 0;
cameraFrame.taa.jitter = 1;

const applySettings = () => {
    cameraFrame.taa.enabled = data.get('data.taa.enabled');
    cameraFrame.rendering.renderTargetScale = data.get('data.scene.scale');
    // Sharpen when TAA is on (same idea as graphics/taa.example.mjs); CameraFrame stays active when TAA is off.
    cameraFrame.rendering.sharpness = data.get('data.taa.enabled') ? 1 : 0;
    cameraFrame.update();
};

data.on('*:set', () => {
    applySettings();
});

data.set('data', {
    scene: {
        scale: 1
    },
    taa: {
        enabled: true
    }
});

applySettings();

const displayCamera = new Entity('DisplayCamera');
displayCamera.addComponent('camera', {
    layers: [worldLayer.id, skyboxLayer.id, uiLayer.id],
    clearColor: new Color(0.55, 0.35, 0.35, 1),
    farClip: 100,
    nearClip: 0.1,
    priority: 0
});
app.root.addChild(displayCamera);

textures.layer = worldLayer;

const matComposite = new ShaderMaterial({
    uniqueName: 'TaaAlphaComposite',
    vertexGLSL: vertGLSL,
    fragmentGLSL: fragCompositeGLSL,
    vertexWGSL: vertWGSL,
    fragmentWGSL: fragCompositeWGSL,
    attributes: { vertex_position: SEMANTIC_POSITION }
});
matComposite.cull = CULLFACE_NONE;
matComposite.depthTest = false;
matComposite.depthWrite = false;
matComposite.blendType = BLEND_NORMAL;
matComposite.setParameter('colorMap', sceneColorTex);
matComposite.update();

// Register the composite once: its custom shader and alpha blending need a mesh instance.
const compositeMesh = new Mesh(device);
compositeMesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]);
compositeMesh.update(PRIMITIVE_TRISTRIP);
const compositeNode = new GraphNode('Alpha composite');
compositeNode.setLocalPosition(0, 0.4, 0);
const composite = new MeshInstance(compositeMesh, matComposite, compositeNode);
composite.cull = false;
composite.castShadow = false;
worldLayer.addMeshInstances([composite]);

const syncSceneRt = () => {
    const { width, height: devHeight } = device;
    if (width < 2 || devHeight < 2) {
        return;
    }
    // Keep the square composite panel at half the viewport width, with one texel per pixel.
    compositeNode.setLocalScale(1, -width / devHeight, 1);
    const panelPx = Math.max(2, Math.floor(width * 0.5));
    sceneRt.resize(panelPx, panelPx);
    cameraFrame.update();
};

syncSceneRt();
device.on('resizecanvas', syncSceneRt);

app.on('destroy', () => {
    device.off('resizecanvas', syncSceneRt);
    worldLayer.removeMeshInstances([composite]);
    composite.destroy();
    matComposite.destroy();
});

app.on('update', () => {
    const gd = app.graphicsDevice;
    const ratio = gd.width / gd.height;

    // Opaque color and alpha previews; the composite is rendered by the transparent sublayer.
    textures.channels = 'rgb';
    textures.draw(sceneColorTex, 0.025, 0.75 - 0.225 * ratio, 0.45, 0.45 * ratio);
    textures.channels = 'aaa';
    textures.draw(sceneColorTex, 0.525, 0.75 - 0.225 * ratio, 0.45, 0.45 * ratio);
});
