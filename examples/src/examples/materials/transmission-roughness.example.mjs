// @config DESCRIPTION This example demonstrates the interaction between roughness and IOR in transmissive materials. Higher IOR values cause more blurriness in transmission as roughness increases, while IOR=1.0 produces sharp transmission regardless of roughness.
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/table-mountain-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new pc.Asset('model', 'container', { url: `${rootPath}/static/assets/models/TransmissionRoughnessTest.glb` })
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

    // Setup skydome - the environment is important for seeing transmission effects
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 70, 0);
    app.scene.skyboxIntensity = 1.5;

    // Instantiate the transmission roughness test model
    // This model shows a grid of transmissive tiles with:
    // - Increasing roughness along the horizontal axis
    // - Increasing IOR along the vertical axis
    const modelEntity = assets.model.resource.instantiateRenderEntity();
    modelEntity.setLocalEulerAngles(0, 90, 0);
    modelEntity.setPosition(0, 0, 0);
    modelEntity.setLocalScale(1, 1, 1);
    app.root.addChild(modelEntity);

    // Create a camera with an orbit camera script
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1),
        toneMapping: pc.TONEMAP_ACES
    });

    // The color grab pass is needed for transmission effects
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
    camera.script.orbitCamera.distance = 2;

    // Add a directional light
    const directionalLight = new pc.Entity();
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        castShadows: false,
        intensity: 1
    });
    directionalLight.setEulerAngles(45, 180, 0);
    app.root.addChild(directionalLight);
});

export { app };
