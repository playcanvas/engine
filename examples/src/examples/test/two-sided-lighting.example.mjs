// @config HIDDEN
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'morning-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/morning-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    model: new pc.Asset('model', 'container', { url: `${rootPath}/static/assets/models/TwoSidedPlane.glb` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
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

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new pc.AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.4;
app.scene.envAtlas = assets.helipad.resource;

const light = new pc.Entity();
light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 0.8, 0.25),
    intensity: 2
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const entity = assets.model.resource.instantiateRenderEntity();
app.root.addChild(entity);

const camera = new pc.Entity();
camera.addComponent('camera', {
    toneMapping: pc.TONEMAP_ACES
});
camera.addComponent('script');
camera.setPosition(0, 2, 6);
app.root.addChild(camera);

const cc = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cc.focusPoint = new pc.Vec3(0, 0, 0);

const lightMaterial = new pc.StandardMaterial();
lightMaterial.emissive = pc.Color.WHITE;
lightMaterial.diffuse = pc.Color.BLACK;
lightMaterial.useLighting = false;
lightMaterial.update();

const omniLight = new pc.Entity();
omniLight.addComponent('light', {
    type: 'omni',
    color: new pc.Color(1, 1, 1),
    intensity: 4,
    range: 10,
    castShadows: false
});
omniLight.addComponent('render', {
    type: 'sphere',
    material: lightMaterial,
    castShadows: false,
    receiveShadows: false
});
omniLight.setLocalScale(0.1, 0.1, 0.1);
app.root.addChild(omniLight);

const orbitRadius = 2;
let time = 0;
app.on('update', (dt) => {
    time += dt * 0.5;
    omniLight.setPosition(
        Math.cos(time) * orbitRadius,
        Math.sin(time) * orbitRadius,
        0
    );
});

export { app };
