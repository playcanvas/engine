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
    TextureHandler,
    WasmModule,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    fallbackUrl: './assets/wasm/draco/draco.js'
});
await new Promise(resolve => {
    WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

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

const assets = {
    heart: new Asset('heart', 'container', { url: './assets/models/heart_draco.glb' })
};

await new Promise(resolve => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight = new Color(0.2, 0.2, 0.2);

// Create an instance using render component
const entity = assets.heart.resource.instantiateRenderEntity({
    receiveShadows: false
});
app.root.addChild(entity);
entity.setLocalScale(20, 20, 20);

// Create an Entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2)
});
camera.translate(0, 0.5, 4);
app.root.addChild(camera);

// Create an entity with a omni light component
const light = new Entity();
light.addComponent('light', {
    type: 'omni',
    intensity: 3
});
light.setLocalPosition(1, 1, 5);
app.root.addChild(light);

app.on('update', dt => {
    if (entity) {
        entity.rotate(4 * dt, -20 * dt, 0);
    }
});
