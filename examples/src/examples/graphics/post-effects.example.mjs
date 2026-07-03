// @config
//
// @credit
// title: Chess Board
// author: Idmental
// source: https://sketchfab.com/3d-models/chess-board-901eeeca884f4622ac37b7e8f7cb82c3
// license: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    KEY_1,
    KEY_2,
    KEY_3,
    KEY_4,
    KEY_5,
    KEY_6,
    Keyboard,
    LAYERID_UI,
    LightComponentSystem,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SCALEMODE_BLEND,
    ScreenComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TextureHandler,
    Vec2,
    Vec3,
    Vec4,
    WasmModule,
    createGraphicsDevice
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
    board: new Asset('statue', 'container', { url: './assets/models/chess-board.glb' }),
    bloom: new Asset('bloom', 'script', { url: './scripts/posteffects/posteffect-bloom.js' }),
    bokeh: new Asset('bokeh', 'script', { url: './scripts/posteffects/posteffect-bokeh.js' }),
    sepia: new Asset('sepia', 'script', { url: './scripts/posteffects/posteffect-sepia.js' }),
    vignette: new Asset('vignette', 'script', {
        url: './scripts/posteffects/posteffect-vignette.js'
    }),
    ssao: new Asset('ssao', 'script', { url: './scripts/posteffects/posteffect-ssao.js' }),
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
    glslangUrl: './assets/wasm/glslang/glslang.js',
    twgslUrl: './assets/wasm/twgsl/twgsl.js'
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    ScreenComponentSystem,
    ElementComponentSystem
];
createOptions.resourceHandlers = [ScriptHandler, TextureHandler, ContainerHandler, FontHandler];

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

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

// setup skydome
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 2;
app.scene.exposure = 1;

/**
 * helper function to create a 3d primitive including its material
 * @param {string} primitiveType - The primitive type.
 * @param {Vec3} position - The position (unused).
 * @param {Vec3} scale - The scale.
 * @param {number} brightness - The brightness (unused).
 * @param {boolean} [_allowEmissive] - Allow emissive (unused).
 * @returns {Entity} The returned entity.
 */
function createPrimitive(primitiveType, position, scale, brightness, _allowEmissive = true) {
    // create a material
    const material = new StandardMaterial();
    material.gloss = 0.4;
    material.metalness = 0.6;
    material.useMetalness = true;
    material.emissive = Color.YELLOW;
    material.update();

    // create the primitive using the material
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        material: material,
        castShadows: false,
        receiveShadows: false
    });

    // set scale and add it to scene
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);

    return primitive;
}

// get the instance of the chess board and set up with render component
const boardEntity = assets.board.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
});
app.root.addChild(boardEntity);

// create a sphere which represents the point of focus for the bokeh filter
const focusPrimitive = createPrimitive('sphere', Vec3.ZERO, new Vec3(3, 3, 3), 1.5, false);

// add an omni light as a child of this sphere
const light = new Entity();
light.addComponent('light', {
    type: 'omni',
    color: Color.YELLOW,
    intensity: 2,
    range: 150,
    shadowDistance: 150,
    castShadows: true
});
focusPrimitive.addChild(light);

// Create an Entity with a camera component, and attach postprocessing effects scripts on it
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    farClip: 500
});
camera.addComponent('script');
data.set('scripts', {
    ssao: {
        enabled: true,
        radius: 5,
        samples: 16,
        brightness: 0,
        downscale: 1
    },
    bloom: {
        enabled: true,
        bloomIntensity: 0.8,
        bloomThreshold: 0.7,
        blurAmount: 15
    },
    sepia: {
        enabled: true,
        amount: 0.4
    },
    vignette: {
        enabled: true,
        darkness: 1,
        offset: 1.2
    },
    bokeh: {
        enabled: true,
        aperture: 0.1,
        maxBlur: 0.02
    }
});

Object.keys(data.get('scripts')).forEach(key => {
    camera.script.create(key, {
        attributes: data.get(`scripts.${key}`)
    });
});

// position the camera in the world
camera.setLocalPosition(0, 30, -60);
camera.lookAt(0, 0, 100);
app.root.addChild(camera);

// Allow user to toggle individual post effects
app.keyboard.on(
    'keydown',
    e => {
        // if the user is editing an input field, ignore key presses
        if (e.element.constructor.name === 'HTMLInputElement') return;
        switch (e.key) {
            case KEY_1:
                data.set('scripts.bloom.enabled', !data.get('scripts.bloom.enabled'));
                break;
            case KEY_2:
                data.set('scripts.sepia.enabled', !data.get('scripts.sepia.enabled'));
                break;
            case KEY_3:
                data.set('scripts.vignette.enabled', !data.get('scripts.vignette.enabled'));
                break;
            case KEY_4:
                data.set('scripts.bokeh.enabled', !data.get('scripts.bokeh.enabled'));
                break;
            case KEY_5:
                data.set('scripts.ssao.enabled', !data.get('scripts.ssao.enabled'));
                break;
            case KEY_6:
                data.set('data.postProcessUI.enabled', !data.get('data.postProcessUI.enabled'));
                break;
        }
    },
    this
);

// Create a 2D screen to place UI on
const screen = new Entity();
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    scaleBlend: 0.5,
    scaleMode: SCALEMODE_BLEND,
    screenSpace: true
});
app.root.addChild(screen);

// create a text element to show which effects are enabled
const text = new Entity();
text.addComponent('element', {
    anchor: new Vec4(0.1, 0.1, 0.5, 0.5),
    fontAsset: assets.font,
    fontSize: 28,
    pivot: new Vec2(0.5, 0.1),
    type: ELEMENTTYPE_TEXT,
    alignment: Vec2.ZERO
});
screen.addChild(text);

// Display some UI text which the post processing can be tested against
text.element.text = 'Test UI Text';

// update things every frame
let angle = 0;
app.on('update', (/** @type {number} */ dt) => {
    angle += dt;

    // rotate the skydome
    app.scene.skyboxRotation = new Quat().setFromEulerAngles(0, angle * 20, 0);

    // move the focus sphere in the world
    const focusPosition = new Vec3(0, 30, Math.sin(1 + angle * 0.3) * 90);
    focusPrimitive.setPosition(focusPosition);

    // set the focus distance to the bokeh effect
    // - it's a negative distance between the camera and the focus sphere
    camera.script.bokeh.focus = -focusPosition.sub(camera.getPosition()).length();

    // orbit the camera around
    camera.setLocalPosition(110 * Math.sin(angle * 0.2), 45, 110 * Math.cos(angle * 0.2));
    focusPosition.y -= 20;
    camera.lookAt(focusPosition);

    // display the depth texture if it was rendered
    if (data.get('scripts.bokeh.enabled') || data.get('scripts.ssao.enabled')) {
        // @ts-ignore engine-tsd
        app.drawDepthTexture(0.7, -0.7, 0.5, -0.5);
    }
});

data.on('*:set', (/** @type {string} */ path, value) => {
    const pathArray = path.split('.');
    if (pathArray[0] === 'scripts') {
        camera.script[pathArray[1]][pathArray[2]] = value;
    } else {
        camera.camera.disablePostEffectsLayer =
            camera.camera.disablePostEffectsLayer === LAYERID_UI ? undefined : LAYERID_UI;
    }
});
