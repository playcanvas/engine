import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    ButtonComponentSystem,
    CameraComponentSystem,
    Color,
    ELEMENTTYPE_IMAGE,
    ELEMENTTYPE_TEXT,
    ElementComponentSystem,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    FontHandler,
    LightComponentSystem,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScreenComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    checkboard: new Asset('checkboard', 'texture', { url: './assets/textures/checkboard.png' }),
    font: new Asset('font', 'font', { url: './assets/fonts/courier.json' }),
    script: new Asset('script', 'script', { url: './scripts/camera/orbit-camera.js' })
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
createOptions.elementInput = new ElementInput(canvas);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScreenComponentSystem,
    ButtonComponentSystem,
    ElementComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, FontHandler, ScriptHandler];

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

// Create an Entity with a camera component and simple orbiter script
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(30 / 255, 30 / 255, 30 / 255)
});
camera.rotateLocal(-30, 0, 0);
camera.translateLocal(0, 0, 7);
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2 // Override default of 0 (no inertia)
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Create an Entity for the ground
const material = new StandardMaterial();
material.diffuse = Color.WHITE;
material.diffuseMap = assets.checkboard.resource;
material.diffuseMapTiling = new Vec2(50, 50);
material.update();

const ground = new Entity();
ground.addComponent('render', {
    type: 'box',
    material: material
});
ground.setLocalScale(50, 1, 50);
ground.setLocalPosition(0, -0.5, 0);
app.root.addChild(ground);

// Create an Entity with a light component
const light = new Entity();
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 1, 1),
    castShadows: true,
    intensity: 1,
    shadowBias: 0.2,
    shadowDistance: 16,
    normalOffsetBias: 0.05,
    shadowResolution: 2048
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

// Create a 3D world screen, which is basically a `screen` with `screenSpace` set to false
const screen = new Entity();
screen.setLocalScale(0.01, 0.01, 0.01);
screen.setPosition(0, 0.01, 0); // place UI slightly above the ground
screen.setLocalRotation(new Quat().setFromEulerAngles(-90, 0, 0));
screen.addComponent('screen', {
    referenceResolution: new Vec2(1280, 720),
    screenSpace: false
});
app.root.addChild(screen);

// Text
const text = new Entity();
text.setLocalPosition(0, 25, 0);
text.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0.5, 0.5, 0.5, 0.5),
    fontAsset: assets.font.id,
    fontSize: 18,
    text: 'this is a UI screen placed in the 3D world',
    width: 200,
    height: 100,
    autoWidth: false,
    autoHeight: false,
    wrapLines: true,
    enableMarkup: true,
    type: ELEMENTTYPE_TEXT
});
screen.addChild(text);

// Button
const button = new Entity();
button.setLocalPosition(0, -25, 0);
button.addComponent('button');
button.addComponent('element', {
    anchor: [0.5, 0.5, 0.5, 0.5],
    width: 100,
    height: 25,
    pivot: [0.5, 0.5],
    type: ELEMENTTYPE_IMAGE,
    useInput: true
});
screen.addChild(button);

// Create a label for the button
const buttonText = new Entity();
buttonText.addComponent('element', {
    pivot: new Vec2(0.5, 0.5),
    anchor: new Vec4(0, 0, 1, 1),
    margin: new Vec4(0, 0, 0, 0),
    color: new Color(0, 0, 0),
    fontAsset: assets.font.id,
    fontSize: 12,
    text: 'and this is a button',
    type: ELEMENTTYPE_TEXT,
    wrapLines: true
});
button.addChild(buttonText);

// Change the background color every time the button is clicked
button.button.on('click', () => {
    camera.camera.clearColor = new Color(Math.random(), Math.random(), Math.random());
});
