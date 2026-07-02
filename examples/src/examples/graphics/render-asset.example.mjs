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
    LightComponentSystem,
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
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' }),
    cube: new Asset('cube', 'container', { url: './assets/models/playcanvas-cube.glb' })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
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

/** @type {Entity[]} */
const cubeEntities = [];

// get the instance of the cube it set up with render component and add it to scene
cubeEntities[0] = assets.cube.resource.instantiateRenderEntity();
cubeEntities[0].setLocalPosition(7, 12, 0);
cubeEntities[0].setLocalScale(3, 3, 3);
app.root.addChild(cubeEntities[0]);

// clone another copy of it and add it to scene
cubeEntities[1] = cubeEntities[0].clone();
cubeEntities[1].setLocalPosition(-7, 12, 0);
cubeEntities[1].setLocalScale(3, 3, 3);
app.root.addChild(cubeEntities[1]);

// get the instance of the statue and set up with render component
const statueEntity = assets.statue.resource.instantiateRenderEntity();
app.root.addChild(statueEntity);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.1, 0.1),
    farClip: 100,
    toneMapping: TONEMAP_ACES
});
camera.translate(-20, 15, 20);
camera.lookAt(0, 7, 0);
app.root.addChild(camera);

// set skybox
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxMip = 1;

// spin the meshes
app.on('update', (dt) => {
    if (cubeEntities[0]) {
        cubeEntities[0].rotate(3 * dt, 10 * dt, 6 * dt);
    }

    if (cubeEntities[1]) {
        cubeEntities[1].rotate(-7 * dt, 5 * dt, -2 * dt);
    }

    if (statueEntity) {
        statueEntity.rotate(0, -12 * dt, 0);
    }
});
