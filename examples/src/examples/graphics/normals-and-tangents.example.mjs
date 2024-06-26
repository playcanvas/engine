// @config HIDDEN
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    orbitCamera: new pc.Asset('script', 'script', { url: rootPath + '/static/scripts/camera/orbit-camera.js' }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new pc.Asset('model', 'container', { url: rootPath + '/static/assets/models/NormalTangentTest.glb' })
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
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Setup skydome
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.rendering.toneMapping = pc.TONEMAP_ACES;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 70, 0);
    app.scene.skyboxIntensity = 1.5;

    const leftEntity = assets.model.resource.instantiateRenderEntity();
    leftEntity.setLocalEulerAngles(0, 90, 0);
    leftEntity.setPosition(0, 0, 1);
    leftEntity.setLocalScale(0.8, 0.8, 0.8);
    app.root.addChild(leftEntity);

    const rightEntity = assets.model.resource.instantiateRenderEntity();
    rightEntity.setLocalEulerAngles(0, 90, 0);
    rightEntity.setPosition(0, 0, -1);
    rightEntity.setLocalScale(-0.8, -0.8, -0.8);
    app.root.addChild(rightEntity);

    // Create a camera with an orbit camera script
    const camera = new pc.Entity();
    camera.addComponent('camera');
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0 // Override default of 0 (no inertia)
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);
    camera.script.orbitCamera.pitch = 0;
    camera.script.orbitCamera.yaw = 90;
    camera.script.orbitCamera.distance = 4;

    const directionalLight = new pc.Entity();
    directionalLight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        castShadows: true,
        intensity: 1,
        shadowBias: 0.2,
        normalOffsetBias: 0.05,
        shadowResolution: 2048
    });
    directionalLight.setEulerAngles(45, 180, 0);
    app.root.addChild(directionalLight);
});

export { app };
