import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

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

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

const assets = {
    statue: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/statue.glb' }),
    script: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' })
};

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

/**
 * @param {pc.Asset[] | number[]} assetList - The asset list.
 * @param {pc.AssetRegistry} assetRegistry - The asset registry.
 * @returns {Promise<void>} The promise.
 */
function loadAssets(assetList, assetRegistry) {
    return new Promise((resolve) => {
        const assetListLoader = new pc.AssetListLoader(assetList, assetRegistry);
        assetListLoader.load(resolve);
    });
}
await loadAssets(Object.values(assets), app.assets);
// Create an entity hierarchy representing the statue
const statueEntity = assets.statue.resource.instantiateRenderEntity();
statueEntity.setLocalScale(0.07, 0.07, 0.07);
statueEntity.setLocalPosition(0, -0.5, 0);
app.root.addChild(statueEntity);

// Create a camera with an orbit camera script
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.4, 0.45, 0.5)
});
camera.addComponent('script');
camera.script.create('orbitCamera', {
    attributes: {
        inertiaFactor: 0.2 // Override default of 0 (no inertia)
    }
});
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
app.root.addChild(camera);

// Create a directional light
const light = new pc.Entity();
light.addComponent('light', {
    type: 'directional'
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

app.start();

export { app };
