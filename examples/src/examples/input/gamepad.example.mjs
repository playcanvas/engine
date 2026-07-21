import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GamePads,
    PAD_1,
    PAD_DOWN,
    PAD_LEFT,
    PAD_RIGHT,
    PAD_UP,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    TEXTURETYPE_RGBP,
    TONEMAP_ACES,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

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

// Set skybox
app.scene.envAtlas = assets.helipad.resource;
app.scene.exposure = 1.6;
app.scene.skyboxMip = 1;

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.4, 0.45, 0.5),
    toneMapping: TONEMAP_ACES
});
camera.translate(0, 7, 25);
app.root.addChild(camera);

const entity = assets.statue.resource.instantiateRenderEntity();
app.root.addChild(entity);

const gamepads = new GamePads();
app.on('update', () => {
    gamepads.update();
    if (gamepads.isPressed(PAD_1, PAD_LEFT)) {
        entity.rotate(0, -1, 0);
    }
    if (gamepads.isPressed(PAD_1, PAD_RIGHT)) {
        entity.rotate(0, 1, 0);
    }
    if (gamepads.wasPressed(PAD_1, PAD_UP)) {
        entity.rotate(-1, 0, 0);
    }
    if (gamepads.wasPressed(PAD_1, PAD_DOWN)) {
        entity.rotate(1, 0, 0);
    }
});
