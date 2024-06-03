import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    checkboard: new pc.Asset('checkboard', 'texture', { url: rootPath + '/static/assets/textures/checkboard.png' }),
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/courier.json' }),
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' })
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScreenComponentSystem,
    pc.ButtonComponentSystem,
    pc.ElementComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler, pc.ScriptHandler];

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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Create an Entity with a camera component and simple orbiter script
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(30 / 255, 30 / 255, 30 / 255)
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
    const material = new pc.StandardMaterial();
    material.diffuse = pc.Color.WHITE;
    material.diffuseMap = assets.checkboard.resource;
    material.diffuseMapTiling = new pc.Vec2(50, 50);
    material.update();

    const ground = new pc.Entity();
    ground.addComponent('render', {
        type: 'box',
        material: material
    });
    ground.setLocalScale(50, 1, 50);
    ground.setLocalPosition(0, -0.5, 0);
    app.root.addChild(ground);

    // Create an entity with a light component
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, 1, 1),
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
    const screen = new pc.Entity();
    screen.setLocalScale(0.01, 0.01, 0.01);
    screen.setPosition(0, 0.01, 0); // place UI slightly above the ground
    screen.setLocalRotation(new pc.Quat().setFromEulerAngles(-90, 0, 0));
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        screenSpace: false
    });
    app.root.addChild(screen);

    // Text
    const text = new pc.Entity();
    text.setLocalPosition(0, 25, 0);
    text.addComponent('element', {
        pivot: new pc.Vec2(0.5, 0.5),
        anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
        fontAsset: assets.font.id,
        fontSize: 18,
        text: 'this is a UI screen placed in the 3D world',
        width: 200,
        height: 100,
        autoWidth: false,
        autoHeight: false,
        wrapLines: true,
        enableMarkup: true,
        type: pc.ELEMENTTYPE_TEXT
    });
    screen.addChild(text);

    // Button
    const button = new pc.Entity();
    button.setLocalPosition(0, -25, 0);
    button.addComponent('button');
    button.addComponent('element', {
        anchor: [0.5, 0.5, 0.5, 0.5],
        width: 100,
        height: 25,
        pivot: [0.5, 0.5],
        type: pc.ELEMENTTYPE_IMAGE,
        useInput: true
    });
    screen.addChild(button);

    // Create a label for the button
    const buttonText = new pc.Entity();
    buttonText.addComponent('element', {
        pivot: new pc.Vec2(0.5, 0.5),
        anchor: new pc.Vec4(0, 0, 1, 1),
        margin: new pc.Vec4(0, 0, 0, 0),
        color: new pc.Color(0, 0, 0),
        fontAsset: assets.font.id,
        fontSize: 12,
        text: 'and this is a button',
        type: pc.ELEMENTTYPE_TEXT,
        wrapLines: true
    });
    button.addChild(buttonText);

    // Change the background color every time the button is clicked
    button.button.on('click', function () {
        camera.camera.clearColor = new pc.Color(Math.random(), Math.random(), Math.random());
    });
});

export { app };
