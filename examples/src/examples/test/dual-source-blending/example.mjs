// @config
//
// Demonstrates dual-source blending, where the fragment shader provides a secondary color used as
// a blend factor. The overlay computes `source0 + destination * source1`, tinting the checkerboard
// differently based on its destination color. Black cells receive only the red `source0`, while
// white cells also add the green `source1` contribution and appear green.
//
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BLENDEQUATION_ADD,
    BLENDMODE_ONE,
    BLENDMODE_SRC1_COLOR,
    BLENDMODE_ZERO,
    BlendState,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    StandardMaterial,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    checkerboard: new Asset(
        'checkerboard-black-white',
        'texture',
        { url: './assets/textures/checkerboard-black-white.png' },
        { mipmaps: false }
    )
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const appOptions = new AppOptions();
appOptions.graphicsDevice = device;
appOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
appOptions.resourceHandlers = [TextureHandler];

const app = new AppBase(canvas);
app.init(appOptions);

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const checkerboardTexture = assets.checkerboard.resource;
checkerboardTexture.minFilter = FILTER_NEAREST;
checkerboardTexture.magFilter = FILTER_NEAREST;

const backgroundMaterial = new StandardMaterial();
backgroundMaterial.useLighting = false;
backgroundMaterial.useTonemap = false;
backgroundMaterial.emissive.set(1, 1, 1);
backgroundMaterial.emissiveMap = checkerboardTexture;
backgroundMaterial.emissiveMapTiling.set(6, 4);
backgroundMaterial.cull = CULLFACE_NONE;
backgroundMaterial.update();

const background = new Entity('Checkerboard');
background.addComponent('render', {
    type: 'plane',
    material: backgroundMaterial
});
background.setLocalEulerAngles(90, 0, 0);
background.setLocalScale(5, 1, 3.2);
app.root.addChild(background);

if (device.supportsDualSourceBlending) {
    const blendMaterial = new StandardMaterial();
    blendMaterial.useLighting = false;
    blendMaterial.useTonemap = false;
    blendMaterial.getShaderChunks(SHADERLANGUAGE_GLSL).set(
        'outputPS',
        /* glsl */ `
        gl_FragColor = vec4(0.45, 0.02, 0.02, 0.0);
        pcFragColorSecondary = vec4(0.0, 0.85, 0.18, 1.0);
    `
    );
    blendMaterial.getShaderChunks(SHADERLANGUAGE_WGSL).set(
        'outputPS',
        /* wgsl */ `
        output.color = vec4f(0.45, 0.02, 0.02, 0.0);
        output.colorSecondary = vec4f(0.0, 0.85, 0.18, 1.0);
    `
    );
    blendMaterial.blendState = new BlendState(
        true,
        BLENDEQUATION_ADD,
        BLENDMODE_ONE,
        BLENDMODE_SRC1_COLOR,
        BLENDEQUATION_ADD,
        BLENDMODE_ZERO,
        BLENDMODE_ONE
    );
    blendMaterial.cull = CULLFACE_NONE;
    blendMaterial.depthWrite = false;
    blendMaterial.update();

    const overlay = new Entity('Dual-source overlay');
    overlay.addComponent('render', {
        type: 'plane',
        material: blendMaterial
    });
    overlay.setLocalPosition(0, 0, 0.01);
    overlay.setLocalEulerAngles(90, 0, 0);
    overlay.setLocalScale(3.5, 1, 2.1);
    app.root.addChild(overlay);
}

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.02, 0.02, 0.02),
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 2
});
camera.setLocalPosition(0, 0, 5);
app.root.addChild(camera);
