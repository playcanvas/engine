import { data } from 'examples/observer';
import { deviceType, fileImport, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);
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

// camera
data.set('camera', {
    proj: pc.PROJECTION_PERSPECTIVE + 1,
    dist: 1,
    fov: 45,
    orthoHeight: 10
});
const camera = new pc.Entity('camera');
camera.addComponent('script');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    farClip: 1000
});
const cameraOffset = 4 * camera.camera.aspectRatio;
camera.setPosition(cameraOffset, cameraOffset, cameraOffset);
app.root.addChild(camera);

// camera controls
const cc = /** @type {CameraControls} */ (camera.script.create(CameraControls));
Object.assign(cc, {
    focusPoint: pc.Vec3.ZERO,
    sceneSize: 5,
    rotateDamping: 0.97,
    moveDamping: 0.97,
    zoomDamping: 0.97,
    pitchRange: new pc.Vec2(-89.999, 89.999),
    zoomRange: new pc.Vec2(2, 10),
    enableFly: false
});
app.on('gizmo:pointer', (/** @type {boolean} */ hasPointer) => {
    cc.skipUpdate = hasPointer;
});

// create light entity
const light = new pc.Entity('light');
light.addComponent('light');
app.root.addChild(light);
light.setEulerAngles(0, 0, -60);

// create gizmo
const layer = pc.Gizmo.createLayer(app);
const gizmo = new pc.ScaleGizmo(camera.camera, layer);
gizmo.on('pointer:down', (_x, _y, /** @type {pc.MeshInstance} */ meshInstance) => {
    app.fire('gizmo:pointer', !!meshInstance);
});
gizmo.on('pointer:up', () => {
    app.fire('gizmo:pointer', false);
});
gizmo.attach(box);
data.set('gizmo', {
    size: gizmo.size,
    snap: gizmo.snap,
    snapIncrement: gizmo.snapIncrement,
    flipPlanes: gizmo.flipPlanes,
    dragMode: gizmo.dragMode,
    uniform: gizmo.uniform,
    theme: {
        shapeBase: {
            x: gizmo.theme.shapeBase.x.toArray(),
            y: gizmo.theme.shapeBase.y.toArray(),
            z: gizmo.theme.shapeBase.z.toArray(),
            xyz: gizmo.theme.shapeBase.xyz.toArray(),
            f: gizmo.theme.shapeBase.f.toArray()
        },
        shapeHover: {
            x: gizmo.theme.shapeHover.x.toArray(),
            y: gizmo.theme.shapeHover.y.toArray(),
            z: gizmo.theme.shapeHover.z.toArray(),
            xyz: gizmo.theme.shapeHover.xyz.toArray(),
            f: gizmo.theme.shapeHover.f.toArray()
        },
        guideBase: {
            x: gizmo.theme.guideBase.x.toArray(),
            y: gizmo.theme.guideBase.y.toArray(),
            z: gizmo.theme.guideBase.z.toArray(),
            f: gizmo.theme.guideBase.f.toArray()
        },
        guideOcclusion: gizmo.theme.guideOcclusion,
        disabled: gizmo.theme.disabled.toArray()
    },
    coordSpace: gizmo.coordSpace,
    axisLineTolerance: gizmo.axisLineTolerance,
    axisGap: gizmo.axisGap,
    axisLineThickness: gizmo.axisLineThickness,
    axisLineLength: gizmo.axisLineLength,
    axisBoxSize: gizmo.axisBoxSize,
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
    const [category, key, ...parts] = path.split('.');
    switch (category) {
        case 'camera': {
            switch (key) {
                case 'proj':
                    camera.camera.projection = value - 1;
                    break;
                case 'fov':
                    camera.camera.fov = value;
                    break;
            }
            break;
        }
        case 'gizmo': {
            if (key === 'theme') {
                if (parts.length === 0) {
                    return;
                }
                const theme = /** @type {any} */ ({});
                let cursor = theme;
                for (let i = 0; i < parts.length - 1; i++) {
                    cursor[parts[i]] = {};
                    cursor = cursor[parts[i]];
                }
                cursor[parts[parts.length - 1]] = Array.isArray(value) ? tmpC.fromArray(value) : value;
                gizmo.setTheme(theme);
                return;
            }
            // @ts-ignore
            gizmo[key] = value;
            break;
        }
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
