// @config
// @credit
// title: Spineboy
// author: Esoteric Software
// source: https://esotericsoftware.com/
// license: (c) 2013 Esoteric Software, non-commercial use only

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    JsonHandler,
    RESOLUTION_AUTO,
    ScriptComponentSystem,
    ScriptHandler,
    TextHandler,
    TextureHandler,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    skeleton: new Asset('skeleton', 'json', { url: './assets/spine/spineboy-pro.json' }),
    atlas: new Asset('atlas', 'text', { url: './assets/spine/spineboy-pro.atlas' }),
    texture: new Asset('spineboy-pro.png', 'texture', { url: './assets/spine/spineboy-pro.png' }),
    spinescript: new Asset('spinescript', 'script', {
        url: './scripts/spine/playcanvas-spine.3.8.js'
    })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler, JsonHandler, TextHandler];

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

// create camera entity
const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.5, 0.6, 0.9)
});
app.root.addChild(camera);
camera.translateLocal(0, 7, 20);

/**
 * @param {Vec3} position - The local-space position.
 * @param {Vec3} scale - The local-space scale.
 * @param {number} timeScale - The animation time scale.
 */
const createSpineInstance = (position, scale, timeScale) => {
    const spineEntity = new Entity();
    spineEntity.addComponent('spine', {
        atlasAsset: assets.atlas.id,
        skeletonAsset: assets.skeleton.id,
        textureAssets: [assets.texture.id]
    });
    spineEntity.setLocalPosition(position);
    spineEntity.setLocalScale(scale);
    app.root.addChild(spineEntity);

    // play spine animation
    // @ts-ignore
    spineEntity.spine.state.setAnimation(0, 'portal', true);

    // @ts-ignore
    spineEntity.spine.state.timeScale = timeScale;
};

// create spine entity 1
createSpineInstance(new Vec3(2, 2, 0), new Vec3(1, 1, 1), 1);

// create spine entity 2
createSpineInstance(new Vec3(2, 10, 0), new Vec3(-0.5, 0.5, 0.5), 0.5);
