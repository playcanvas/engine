// @config DESCRIPTION <div style='text-align:center'><div>(<b>LMB / RMB </b>) Orbit</div><div>(<b>Hold Shift / MMB </b>) Pan</div><div>(<b>Wheel / Pinch</b>) Zoom</div><div>(<b>F</b>) Focus (<b>R</b>) Reset</div></div>
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);

const tmpVa = new pc.Vec2();

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    statue: new pc.Asset('statue', 'container', { url: `${rootPath}/static/assets/models/statue.glb` })
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

/**
 * Calculate the bounding box of an entity.
 *
 * @param {pc.BoundingBox} bbox - The bounding box.
 * @param {pc.Entity} entity - The entity.
 * @returns {pc.BoundingBox} The bounding box.
 */
const calcEntityAABB = (bbox, entity) => {
    bbox.center.set(0, 0, 0);
    bbox.halfExtents.set(0, 0, 0);
    entity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((/** @type {pc.MeshInstance} */ mi) => {
            bbox.add(mi.aabb);
        });
    });
    return bbox;
};

const start = new pc.Vec3(0, 20, 30);
const bbox = calcEntityAABB(new pc.BoundingBox(), statue);

const camera = new pc.Entity();
camera.addComponent('camera');
camera.addComponent('script');
camera.setPosition(start);
app.root.addChild(camera);
const cc = /** @type { CameraControls} */ (camera.script.create(CameraControls));
const sceneSize = bbox.halfExtents.length();
Object.assign(cc, {
    focusPoint: bbox.center,
    enableFly: false,
    moveSpeed: 2 * sceneSize,
    moveFastSpeed: 4 * sceneSize,
    moveSlowSpeed: sceneSize
});

// focus on entity when 'f' key is pressed
const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    switch (e.key) {
        case 'f': {
            cc.focus(bbox.center, true);
            break;
        }
        case 'l': {
            cc.look(bbox.center);
            break;
        }
        case 'r': {
            cc.reset(bbox.center, start);
            break;
        }
    }
};
window.addEventListener('keydown', onKeyDown);
app.on('destroy', () => {
    window.removeEventListener('keydown', onKeyDown);
});

// Bind controls to camera attributes
data.set('attr', [
    'rotateSpeed',
    'moveSpeed',
    'zoomSpeed',
    'zoomPinchSens',
    'focusDamping',
    'rotateDamping',
    'moveDamping',
    'zoomDamping',
    'pitchRange',
    'yawRange',
    'zoomRange',
    'zoomScaleMin'
].reduce((/** @type {Record<string, any>} */ obj, key) => {
    const value = cc[key];

    if (value instanceof pc.Vec2) {
        obj[key] = [value.x, value.y];
        return obj;
    }

    obj[key] = cc[key];
    return obj;
}, {}));

data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    const [category, key, index] = path.split('.');
    if (category !== 'attr') {
        return;
    }

    if (Array.isArray(value)) {
        cc[key] = tmpVa.set(value[0], value[1]);
        return;
    }
    if (index !== undefined) {
        const arr = data.get(`${category}.${key}`);
        cc[key] = tmpVa.set(arr[0], arr[1]);
        return;
    }

    cc[key] = value;
});

export { app };
