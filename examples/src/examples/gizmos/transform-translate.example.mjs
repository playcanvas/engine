import { data } from 'examples/observer';
import { deviceType, fileImport, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const { Grid } = await fileImport(`${rootPath}/static/scripts/esm/grid.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.keyboard = new pc.Keyboard(window);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.FontHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// load assets
const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    font: new pc.Asset('font', 'font', { url: `${rootPath}/static/assets/fonts/courier.json` })
};
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

app.start();

// scene settings
app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

// create entities
const box = new pc.Entity('box');
box.addComponent('render', {
    type: 'box'
});
app.root.addChild(box);

// create camera entity
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    farClip: 1000
});
camera.addComponent('script');
const orbitCamera = camera.script.create('orbitCamera');
camera.script.create('orbitCameraInputMouse');
camera.script.create('orbitCameraInputTouch');
camera.setPosition(1, 1, 1);
app.root.addChild(camera);
orbitCamera.distance = 5 * camera.camera.aspectRatio;
data.set('camera', {
    proj: camera.camera.projection + 1,
    fov: camera.camera.fov
});

// create light entity
const light = new pc.Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// create gizmo
const layer = pc.Gizmo.createLayer(app);
const gizmo = new pc.TranslateGizmo(camera.camera, layer);
gizmo.attach(box);
data.set('gizmo', {
    size: gizmo.size,
    snapIncrement: gizmo.snapIncrement,
    xAxisColor: gizmo.xAxisColor.toArray(),
    yAxisColor: gizmo.yAxisColor.toArray(),
    zAxisColor: gizmo.zAxisColor.toArray(),
    xHoverColor: gizmo.xHoverColor.toArray(),
    yHoverColor: gizmo.yHoverColor.toArray(),
    zHoverColor: gizmo.zHoverColor.toArray(),
    disabledColor: gizmo.disabledColor.toArray(),
    xGuideColor: gizmo.xGuideColor.toArray(),
    yGuideColor: gizmo.yGuideColor.toArray(),
    zGuideColor: gizmo.zGuideColor.toArray(),
    shading: gizmo.shading,
    coordSpace: gizmo.coordSpace,
    axisLineTolerance: gizmo.axisLineTolerance,
    axisCenterTolerance: gizmo.axisCenterTolerance,
    axisGap: gizmo.axisGap,
    axisLineThickness: gizmo.axisLineThickness,
    axisLineLength: gizmo.axisLineLength,
    axisArrowThickness: gizmo.axisArrowThickness,
    axisArrowLength: gizmo.axisArrowLength,
    axisPlaneSize: gizmo.axisPlaneSize,
    axisPlaneGap: gizmo.axisPlaneGap,
    axisCenterSize: gizmo.axisCenterSize
});

// create grid
const gridEntity = new pc.Entity('grid');
gridEntity.setLocalScale(4, 1, 4);
app.root.addChild(gridEntity);
gridEntity.addComponent('script');
gridEntity.script.create(Grid);

// controls hook
const tmpC = new pc.Color();
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const [category, key] = path.split('.');
    switch (category) {
        case 'camera':
            switch (key) {
                case 'proj':
                    camera.camera.projection = value - 1;
                    break;
                case 'fov':
                    camera.camera.fov = value;
                    break;
            }
            return;
        case 'gizmo':
            // @ts-ignore
            if (gizmo[key] instanceof pc.Color) {
                // @ts-ignore
                gizmo[key] = tmpC.fromArray(value);
                return;
            }

            // @ts-ignore
            gizmo[key] = value;
    }
});

// ensure canvas is resized when window changes size + keep gizmo size consistent to canvas size
const resize = () => {
    app.resizeCanvas();
    const bounds = canvas.getBoundingClientRect();
    const dim = camera.camera.horizontalFov ? bounds.width : bounds.height;
    data.set('gizmo.size', 1024 / dim);
};
window.addEventListener('resize', resize);
resize();

app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

export { app };
