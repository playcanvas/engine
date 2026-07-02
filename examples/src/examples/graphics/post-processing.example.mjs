// @config
//
// @credit
// title: Real-time Refraction Demo: Mosquito in Amber
// author: Sketchfab
// source: https://sketchfab.com/3d-models/real-time-refraction-demo-mosquito-in-amber-37233d6ed84844fea1ebe88069ea58d1
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)
//
// @credit
// title: Scifi Platform Stage Scene (Baked)
// author: Sketchfab
// source: https://sketchfab.com/3d-models/scifi-platform-stage-scene-baked-64adb59a716d43e5a8705ff6fe86c0ce
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    Keyboard,
    LAYERID_UI,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec4,
    WasmModule,
    createGraphicsDevice,
    math
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// set up and load draco module, as the glb we load is draco compressed
WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});

const assets = {
    orbit: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' }),
    platform: new Asset('statue', 'container', { url: './assets/models/scifi-platform.glb' }),
    mosquito: new Asset('mosquito', 'container', { url: './assets/models/MosquitoInAmber.glb' }),
    font: new Asset('font', 'font', { url: './assets/fonts/arial.json' }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],

    // The scene is rendered to an antialiased texture, so we disable antialiasing on the canvas
    // to avoid the additional cost. This is only used for the UI which renders on top of the
    // post-processed scene, and we're typically happy with some aliasing on the UI.
    antialias: false
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(window);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, FontHandler];

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

// setup skydome with low intensity
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 0.3;

// disable skydome rendering itself, we don't need it as we use camera clear color
app.scene.layers.getLayerByName('Skybox').enabled = false;

// create an instance of the platform and add it to the scene
const platformEntity = assets.platform.resource.instantiateRenderEntity();
platformEntity.setLocalScale(10, 10, 10);
app.root.addChild(platformEntity);

// get a list of emissive materials from the scene to allow their intensity to be changed
const emissiveMaterials = [];
const emissiveNames = new Set(['Light_Upper_Light-Upper_0', 'Emissive_Cyan__0']);
platformEntity.findComponents('render').forEach((render) => {
    if (emissiveNames.has(render.entity.name)) {
        render.meshInstances.forEach(meshInstance => emissiveMaterials.push(meshInstance.material));
    }
});

// add an instance of the mosquito mesh
const mosquitoEntity = assets.mosquito.resource.instantiateRenderEntity();
mosquitoEntity.setLocalScale(600, 600, 600);
mosquitoEntity.setLocalPosition(0, 20, 0);
app.root.addChild(mosquitoEntity);

// helper function to create a box primitive
const createBox = (x, y, z, r, g, b, emissive, name) => {
    // create material of random color
    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.emissive = new Color(r, g, b);
    material.emissiveIntensity = emissive;
    material.update();

    // create primitive
    const primitive = new Entity(name);
    primitive.addComponent('render', {
        type: 'box',
        material: material
    });

    // set position and scale
    primitive.setLocalPosition(x, y, z);
    app.root.addChild(primitive);

    return primitive;
};

// create 3 emissive boxes
const boxes = [
    createBox(100, 20, 0, 1, 0, 0, 60, 'boxRed'),
    createBox(-50, 20, 100, 0, 1, 0, 60, 'boxGreen'),
    createBox(90, 20, -80, 1, 1, 0.25, 50, 'boxYellow')
];

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    farClip: 500,
    fov: 80
});

// add orbit camera script with a mouse and a touch support
cameraEntity.addComponent('script');

// add orbit camera script with a mouse and a touch support
cameraEntity.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2,
        focusEntity: mosquitoEntity,
        distanceMax: 190,
        frameOnStart: false
    }
});
cameraEntity.script.create('orbitCameraInputMouse');
cameraEntity.script.create('orbitCameraInputTouch');

cameraEntity.setLocalPosition(0, 40, -220);
cameraEntity.lookAt(0, 0, 100);
app.root.addChild(cameraEntity);

// Create a 2D screen to place UI on
const screen = new Entity();
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

// add a shadow casting directional light
const lightColor = new Color(1, 0.7, 0.1);
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: lightColor,
    intensity: 80,
    range: 400,
    shadowResolution: 4096,
    shadowDistance: 400,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
});
app.root.addChild(light);
light.setLocalEulerAngles(80, 10, 0);

// a helper function to add a label to the screen
const addLabel = (name, text, x, y, layer) => {
    const label = new Entity(name);
    label.addComponent('element', {
        text: text,

        // very bright color to affect the bloom - this is not correct, as this is sRGB color that
        // is valid only in 0..1 range, but UI does not expose emissive intensity currently
        color: new Color(18, 15, 5),

        anchor: new Vec4(x, y, 0.5, 0.5),
        fontAsset: assets.font,
        fontSize: 28,
        pivot: new Vec2(0.5, 0.1),
        type: ELEMENTTYPE_TEXT,
        alignment: Vec2.ZERO,
        layers: [layer.id]
    });
    screen.addChild(label);
};

// add a label on the world layer, which will be affected by post-processing
const worldLayer = app.scene.layers.getLayerByName('World');
addLabel('WorldUI', 'Text on the World layer affected by post-processing', 0.1, 0.9, worldLayer);

// add a label on the UI layer, which will be rendered after the post-processing
const uiLayer = app.scene.layers.getLayerById(LAYERID_UI);
addLabel('TopUI', 'Text on theUI layer after the post-processing', 0.1, 0.1, uiLayer);

// ------ Custom render passes set up ------

const cameraFrame = new CameraFrame(app, cameraEntity.camera);
cameraFrame.rendering.sceneColorMap = true;
cameraFrame.update();

const applySettings = () => {
    // background
    const background = data.get('data.scene.background');
    cameraEntity.camera.clearColor = new Color(
        lightColor.r * background,
        lightColor.g * background,
        lightColor.b * background
    );
    light.light.intensity = background;

    // emissive
    const emissive = data.get('data.scene.emissive');
    emissiveMaterials.forEach((material) => {
        material.emissiveIntensity = emissive;
        material.update();
    });

    // enabled
    cameraFrame.enabled = data.get('data.enabled');

    // Scene
    cameraFrame.rendering.renderTargetScale = data.get('data.scene.scale');
    cameraFrame.rendering.toneMapping = data.get('data.scene.tonemapping');

    // TAA
    cameraFrame.taa.enabled = data.get('data.taa.enabled');
    cameraFrame.taa.jitter = data.get('data.taa.jitter');

    // Bloom
    cameraFrame.bloom.intensity = data.get('data.bloom.enabled') ?
        math.lerp(0, 0.1, data.get('data.bloom.intensity') / 100) :
        0;
    cameraFrame.bloom.blurLevel = data.get('data.bloom.blurLevel');

    // grading
    cameraFrame.grading.enabled = data.get('data.grading.enabled');
    cameraFrame.grading.saturation = data.get('data.grading.saturation');
    cameraFrame.grading.brightness = data.get('data.grading.brightness');
    cameraFrame.grading.contrast = data.get('data.grading.contrast');

    // colorEnhance
    cameraFrame.colorEnhance.enabled = data.get('data.colorEnhance.enabled');
    if (cameraFrame.colorEnhance.enabled) {
        cameraFrame.colorEnhance.shadows = data.get('data.colorEnhance.shadows');
        cameraFrame.colorEnhance.highlights = data.get('data.colorEnhance.highlights');
        cameraFrame.colorEnhance.midtones = data.get('data.colorEnhance.midtones');
        cameraFrame.colorEnhance.vibrance = data.get('data.colorEnhance.vibrance');
        cameraFrame.colorEnhance.dehaze = data.get('data.colorEnhance.dehaze');
    }

    // vignette
    cameraFrame.vignette.inner = data.get('data.vignette.inner');
    cameraFrame.vignette.outer = data.get('data.vignette.outer');
    cameraFrame.vignette.curvature = data.get('data.vignette.curvature');
    cameraFrame.vignette.intensity = data.get('data.vignette.enabled') ? data.get('data.vignette.intensity') : 0;
    const vignetteColor = data.get('data.vignette.color');
    if (vignetteColor) {
        cameraFrame.vignette.color.set(vignetteColor[0], vignetteColor[1], vignetteColor[2]);
    }

    // fringing
    cameraFrame.fringing.intensity = data.get('data.fringing.enabled') ? data.get('data.fringing.intensity') : 0;

    // debug
    switch (data.get('data.scene.debug')) {
        case 0:
            cameraFrame.debug = null;
            break;
        case 1:
            cameraFrame.debug = 'bloom';
            break;
        case 2:
            cameraFrame.debug = 'vignette';
            break;
        case 3:
            cameraFrame.debug = 'scene';
            break;
    }

    // apply all settings
    cameraFrame.update();
};

// apply UI changes
data.on('*:set', () => {
    applySettings();
});

// set initial values
data.set('data', {
    enabled: true,
    scene: {
        scale: 1.8,
        background: 6,
        emissive: 200,
        tonemapping: TONEMAP_ACES,
        debug: 0
    },
    bloom: {
        enabled: true,
        intensity: 5,
        blurLevel: 16
    },
    grading: {
        enabled: false,
        saturation: 1,
        brightness: 1,
        contrast: 1
    },
    colorEnhance: {
        enabled: false,
        shadows: 0,
        highlights: 0,
        midtones: 0,
        vibrance: 0,
        dehaze: 0
    },
    vignette: {
        enabled: false,
        inner: 0.5,
        outer: 1.0,
        curvature: 0.5,
        intensity: 0.3,
        color: [0, 0, 0]
    },
    fringing: {
        enabled: false,
        intensity: 50
    },
    taa: {
        enabled: false,
        jitter: 1
    }
});

// update things every frame
let angle = 0;
app.on('update', (/** @type {number} */ dt) => {
    angle += dt;

    // scale the boxes
    for (let i = 0; i < boxes.length; i++) {
        const offset = (Math.PI * 2 * i) / boxes.length;
        const scale = 25 + Math.sin(angle + offset) * 10;
        boxes[i].setLocalScale(scale, scale, scale);
    }

    // rotate the mosquitoEntity
    mosquitoEntity.setLocalEulerAngles(0, angle * 30, 0);
});
