import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: rootPath + '/static/lib/draco/draco.wasm.js',
    wasmUrl: rootPath + '/static/lib/draco/draco.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/draco/draco.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('DracoDecoderModule', () => resolve());
});

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

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

const assets = {
    heart: new pc.Asset('heart', 'container', { url: rootPath + '/static/assets/models/heart_draco.glb' })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

    // create an instance using render component
    const entity = assets.heart.resource.instantiateRenderEntity({
        receiveShadows: false
    });
    app.root.addChild(entity);
    entity.setLocalScale(20, 20, 20);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.2, 0.2, 0.2)
    });
    camera.translate(0, 0.5, 4);
    app.root.addChild(camera);

    // Create an entity with a omni light component
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'omni',
        intensity: 3
    });
    light.setLocalPosition(1, 1, 5);
    app.root.addChild(light);

    app.on('update', function (dt) {
        if (entity) {
            entity.rotate(4 * dt, -20 * dt, 0);
        }
    });
});

export { app };
