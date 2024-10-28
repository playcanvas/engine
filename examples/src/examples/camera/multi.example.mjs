// @config DESCRIPTION <div style='text-align:center'><div>(<b>WASDQE</b>) Move</div><div>(<b>LMB</b>) Orbit, (<b>RMB</b>) Fly</div><div>(<b>Scroll Wheel</b>) zoom</div><div>(<b>MMB / Hold Shift</b>) Pan</div><div>(<b>F</b>) Focus</div></div>
// @config HIDDEN
import * as pc from 'playcanvas';
import { deviceType, rootPath, fileImport } from 'examples/utils';

const { MultiCameraScript } = await fileImport(rootPath + '/static/scripts/camera/multi-camera.js');

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    statue: new pc.Asset('statue', 'container', { url: rootPath + '/static/assets/models/statue.glb' })
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler];

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

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

/**
 * @param {pc.Entity} focus - The entity to focus the camera on.
 * @returns {pc.Entity} The multi-camera entity.
 */
function createMultiCamera(focus) {
    const camera = new pc.Entity();
    camera.addComponent('camera');

    const multiCamera = new pc.Entity();
    multiCamera.addComponent('script');
    const multiCameraScript = /** @type {MultiCameraScript} */ (multiCamera.script.create(MultiCameraScript));
    multiCameraScript.attach(camera);

    // focus on entity when 'f' key is pressed
    const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
        if (e.key === 'f') {
            multiCameraScript.focusOnEntity(focus);
        }
    };
    window.addEventListener('keydown', onKeyDown);
    app.on('destroy', () => {
        window.removeEventListener('keydown', onKeyDown);
    });

    // wait until after canvas resized to focus on entity
    const resize = new ResizeObserver(() => {
        multiCameraScript.focusOnEntity(focus, true);
        resize.disconnect();
    });
    resize.observe(canvas);

    return multiCamera;
}

app.start();

app.scene.ambientLight.set(0.4, 0.4, 0.4);

app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.4;
app.scene.envAtlas = assets.helipad.resource;

// Create a directional light
const light = new pc.Entity();
light.addComponent('light');
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const statue = assets.statue.resource.instantiateRenderEntity();
statue.setLocalPosition(0, -0.5, 0);
app.root.addChild(statue);

const multiCamera = createMultiCamera(statue);
app.root.addChild(multiCamera);

export { app };
