// @config HIDDEN
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/morning-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new pc.Asset('model', 'container', { url: `${rootPath}/static/assets/models/AttenuationTest.glb` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(document.body);

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
window.addEventListener('orientationchange', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    const leftEntity = assets.model.resource.instantiateRenderEntity();
    leftEntity.setLocalEulerAngles(0, 90, 0);
    leftEntity.setPosition(0, 0, 1);
    leftEntity.setLocalScale(0.8, 0.8, 0.8);
    app.root.addChild(leftEntity);

    // Create a camera with an orbit camera script
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        toneMapping: pc.TONEMAP_LINEAR
    });
    camera.camera.requestSceneColorMap(true);
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);
    camera.script.orbitCamera.yaw = 90;
    camera.script.orbitCamera.distance = 24;

    // test with camera frame which uses linear rendering
    const cameraFrame = false;

    if (cameraFrame) {
        const cameraFrame = new pc.CameraFrame(app, camera.camera);
        cameraFrame.rendering.samples = 4;
        cameraFrame.rendering.toneMapping = pc.TONEMAP_LINEAR;
        cameraFrame.rendering.sceneColorMap = true;
        cameraFrame.update();
    }

    app.scene.ambientLight = new pc.Color(0.9, 0.9, 0.9);
});

export { app };
