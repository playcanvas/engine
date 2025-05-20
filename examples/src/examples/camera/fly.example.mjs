// @config DESCRIPTION <div style='text-align:center'><div>(<b>WASDQE</b>) Move </div><div>(<b>Hold Shift</b>) Move Fast (<b>Hold Ctrl</b>) Move Slow</div><div>(<b>LMB / RMB </b>) Fly</div></div>
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
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
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
Object.assign(cc, {
    sceneSize: bbox.halfExtents.length(),
    focusPoint: bbox.center,
    enableOrbit: false,
    enablePan: false
});

/**
 * @param {string} side - The name.
 * @param {number} baseSize - The base size.
 * @param {number} stickSize - The stick size.
 */
const createJoystickUI = (side, baseSize = 100, stickSize = 60) => {
    const base = document.createElement('div');
    Object.assign(base.style, {
        display: 'none',
        position: 'absolute',
        width: `${baseSize}px`,
        height: `${baseSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(50, 50, 50, 0.5)',
        boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)'
    });

    const stick = document.createElement('div');
    Object.assign(stick.style, {
        display: 'none',
        position: 'absolute',
        width: `${stickSize}px`,
        height: `${stickSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.5)'
    });

    app.on(`${cc.joystickBaseEventName}:${side}`, (x, y) => {
        const left = x - baseSize * 0.5;
        const top = y - baseSize * 0.5;

        base.style.display = 'block';
        base.style.left = `${left}px`;
        base.style.top = `${top}px`;
    });
    app.on(`${cc.joystickStickEventName}:${side}`, (x, y) => {
        const left = x - stickSize * 0.5;
        const top = y - stickSize * 0.5;

        stick.style.display = 'block';
        stick.style.left = `${left}px`;
        stick.style.top = `${top}px`;
    });
    app.on(`${cc.joystickResetEventName}:${side}`, () => {
        base.style.display = 'none';
        stick.style.display = 'none';
    });

    document.body.append(base, stick);
};

// Create joystick UI
createJoystickUI('left');
createJoystickUI('right');

// Bind controls to camera attributes
data.set('attr', [
    'rotateSpeed',
    'rotateJoystickSens',
    'moveSpeed',
    'moveFastSpeed',
    'moveSlowSpeed',
    'rotateDamping',
    'moveDamping',
    'pitchRange',
    'yawRange',
    'gamepadDeadZone',
    'mobileInputLayout'
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
