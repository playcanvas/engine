import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// The example demonstrates loading of glb file, which contains meshes,
// lights and cameras, and switches between the cameras every 2 seconds.

const assets = {
    scene: new pc.Asset('scene', 'container', { url: rootPath + '/static/assets/models/geometry-camera-light.glb' })
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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    /**
     * the array will store loaded cameras
     * @type {pc.CameraComponent[]}
     */
    let camerasComponents = null;

    // glb lights use physical units
    app.scene.physicalUnits = true;

    // create an instance using render component
    const entity = assets.scene.resource.instantiateRenderEntity({});
    app.root.addChild(entity);

    // find all cameras - by default they are disabled
    camerasComponents = entity.findComponents('camera');
    camerasComponents.forEach((component) => {
        // set the aspect ratio to automatic to work with any window size
        component.aspectRatioMode = pc.ASPECT_AUTO;

        // set up exposure for physical units
        component.aperture = 4;
        component.shutter = 1 / 100;
        component.sensitivity = 500;
    });

    /** @type {pc.LightComponent[]} */
    const lightComponents = entity.findComponents('light');
    // enable all lights from the glb
    lightComponents.forEach((component) => {
        component.enabled = true;
    });

    let time = 0;
    let activeCamera = 0;
    app.on('update', function (dt) {
        time -= dt;

        // change the camera every few seconds
        if (time <= 0) {
            time = 2;

            // disable current camera
            camerasComponents[activeCamera].enabled = false;

            // activate next camera
            activeCamera = (activeCamera + 1) % camerasComponents.length;
            camerasComponents[activeCamera].enabled = true;
        }
    });
});

export { app };
