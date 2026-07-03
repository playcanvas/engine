// @config
//
// `WASDQE` Move · Hold `Shift` Move fast · Hold `Ctrl` Move slow · `LMB` / `RMB` Fly

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TEXTURETYPE_RGBP,
    TextureHandler,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { MeshInstance } from 'playcanvas'
 */

const tmpVa = new Vec2();

const canvas = document.getElementById('application-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('No canvas found');
}
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    ),
    statue: new Asset('statue', 'container', { url: './assets/models/statue.glb' })
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.ambientLight.set(0.4, 0.4, 0.4);

app.scene.skyboxMip = 1;
app.scene.skyboxIntensity = 0.4;
app.scene.envAtlas = assets.helipad.resource;

// Create a directional light
const light = new Entity();
light.addComponent('light');
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const statue = assets.statue.resource.instantiateRenderEntity();
statue.setLocalPosition(0, -0.5, 0);
app.root.addChild(statue);

/**
 * Calculate the bounding box of an entity.
 *
 * @param {BoundingBox} bbox - The bounding box.
 * @param {Entity} entity - The entity.
 * @returns {BoundingBox} The bounding box.
 */
const calcEntityAABB = (bbox, entity) => {
    bbox.center.set(0, 0, 0);
    bbox.halfExtents.set(0, 0, 0);
    entity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((/** @type {MeshInstance} */ mi) => {
            bbox.add(mi.aabb);
        });
    });
    return bbox;
};

const start = new Vec3(0, 20, 30);
const bbox = calcEntityAABB(new BoundingBox(), statue);

const camera = new Entity();
camera.addComponent('camera');
camera.addComponent('script');
camera.setPosition(start);
app.root.addChild(camera);
const cc = /** @type { CameraControls} */ (camera.script.create(CameraControls));
const sceneSize = bbox.halfExtents.length();
Object.assign(cc, {
    focusPoint: bbox.center,
    enableOrbit: false,
    enablePan: false,
    moveSpeed: 2 * sceneSize,
    moveFastSpeed: 4 * sceneSize,
    moveSlowSpeed: sceneSize
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

    /**
     * @param {HTMLElement} el - The element to set position for.
     * @param {number} size - The size of the element.
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    const show = (el, size, x, y) => {
        el.style.display = 'block';
        el.style.left = `${x - size * 0.5}px`;
        el.style.top = `${y - size * 0.5}px`;
    };

    /**
     * @param {HTMLElement} el - The element to hide.
     */
    const hide = (el) => {
        el.style.display = 'none';
    };

    app.on(`${cc.joystickEventName}:${side}`, (bx, by, sx, sy) => {
        if (bx < 0 || by < 0 || sx < 0 || sy < 0) {
            hide(base);
            hide(stick);
            return;
        }

        show(base, baseSize, bx, by);
        show(stick, stickSize, sx, sy);
    });

    document.body.append(base, stick);
};

// Create joystick UI
createJoystickUI('left');
createJoystickUI('right');

// Bind controls to camera attributes
data.set(
    'attr',
    [
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

        if (value instanceof Vec2) {
            obj[key] = [value.x, value.y];
            return obj;
        }

        obj[key] = cc[key];
        return obj;
    }, {})
);

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
