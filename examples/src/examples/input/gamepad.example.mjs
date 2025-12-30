import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// Create the application and start the update loop

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    statue: new pc.Asset('statue', 'container', { url: `${rootPath}/static/assets/models/statue.glb` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);


const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // set skybox
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.exposure = 1.6;
    app.scene.skyboxMip = 1;

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5),
        toneMapping: pc.TONEMAP_ACES
    });
    camera.translate(0, 7, 25);
    app.root.addChild(camera);

    const entity = assets.statue.resource.instantiateRenderEntity();
    app.root.addChild(entity);

    const gamepads = new pc.GamePads();
    app.on('update', () => {
        gamepads.update();
        if (gamepads.isPressed(pc.PAD_1, pc.PAD_LEFT)) {
            entity.rotate(0, -1, 0);
        }
        if (gamepads.isPressed(pc.PAD_1, pc.PAD_RIGHT)) {
            entity.rotate(0, 1, 0);
        }
        if (gamepads.wasPressed(pc.PAD_1, pc.PAD_UP)) {
            entity.rotate(-1, 0, 0);
        }
        if (gamepads.wasPressed(pc.PAD_1, pc.PAD_DOWN)) {
            entity.rotate(1, 0, 0);
        }
    });
});

export { app };
