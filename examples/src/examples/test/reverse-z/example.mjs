// @config
//
// Compares the standard depth buffer (left) with reverse-z (right, CameraComponent#reverseZ) over
// distances from 1 m to 300 km, with a near clip of 0.1 and a far clip of a million. The gain needs
// a floating point depth buffer: with 32-bit float depth, reverse-z stays clean to 300 km, while
// fixed-point depth gains little.
//
// Notes: the gap between the squares of a panel grows with its distance (1 cm up close), to stay
// above the precision of the 32-bit vertex positions, which no depth buffer can improve. WebGPU
// leaves the storage of the 24-bit format to the GPU, and some store it as a float.
//
// @flag HIDDEN
// @flag WEBGL_DISABLED

import {
    ADDRESS_CLAMP_TO_EDGE,
    AppBase,
    AppOptions,
    CULLFACE_NONE,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    FILTER_NEAREST,
    LAYERID_UI,
    LAYERID_WORLD,
    PIXELFORMAT_DEPTH,
    PIXELFORMAT_DEPTH16,
    PIXELFORMAT_DEPTHSTENCIL,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    StandardMaterial,
    Texture,
    TextureRenderer,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const appOptions = new AppOptions();
appOptions.graphicsDevice = device;
appOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem];

const app = new AppBase(canvas);
app.init(appOptions);
app.start();

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// the gap between the red square and the blue one behind it, a centimeter close up, growing with
// the distance. The positions of the vertices are 32-bit floats, which cannot place surfaces a
// centimeter apart hundreds of kilometers away - at 300 km they step by about 3 cm - so a fixed gap
// would z-fight far away whatever the depth buffer. This gap stays well above that, and far below
// what the standard depth can resolve at the same distance.
const gap = (distance) => Math.max(0.01, distance * 2e-6);

/**
 * @param {Color} color - The color of the material.
 * @returns {StandardMaterial} An unlit material.
 */
const createMaterial = (color) => {
    const material = new StandardMaterial();
    material.useLighting = false;
    material.useTonemap = false;
    material.useFog = false;
    material.emissive = color;
    material.diffuse = Color.BLACK;
    material.cull = CULLFACE_NONE;
    material.update();
    return material;
};

const backMaterial = createMaterial(new Color(0.1, 0.35, 1));
const frontMaterial = createMaterial(new Color(1, 0.12, 0.1));

/**
 * @param {string} name - The name of the entity.
 * @param {StandardMaterial} material - The material of the plane.
 * @returns {Entity} A plane, facing up.
 */
const createPlane = (name, material) => {
    const entity = new Entity(name);
    entity.addComponent('render', {
        type: 'plane',
        material,
        castShadows: false,
        receiveShadows: false
    });
    app.root.addChild(entity);
    return entity;
};

// the panels, from a meter to 300 km away, in two rows across the view, above and below its
// center: up to 300 m in the top row, and from 1 km in the bottom one. Each is scaled with its distance so that it covers the same part
// of the view. A red square floats in front of a blue one, larger, so the blue frames the red.
const distances = [1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000];
const columns = 6;
distances.forEach((distance, i) => {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const yaw = ((-30 + (60 * column) / (columns - 1)) * Math.PI) / 180;
    const elevation = ((row === 0 ? 8 : -8) * Math.PI) / 180;

    const panel = new Entity(`Panel ${distance}m`);
    panel.setLocalPosition(Math.sin(yaw) * distance, Math.tan(elevation) * distance, -Math.cos(yaw) * distance);
    app.root.addChild(panel);

    // face the eye: the planes face up, which the rotation turns towards the eye
    panel.lookAt(0, 0, 0);
    panel.rotateLocal(-90, 0, 0);

    const size = distance * 0.13;
    const back = createPlane('Back', backMaterial);
    back.setLocalScale(size, 1, size);
    panel.addChild(back);

    const front = createPlane('Front', frontMaterial);
    front.setLocalScale(size * 0.7, 1, size * 0.7);
    front.setLocalPosition(0, gap(distance), 0);
    panel.addChild(front);
});

/**
 * @typedef {object} View
 * @property {Entity} camera - The camera rendering the view.
 * @property {RenderTarget|null} renderTarget - The render target the camera renders into.
 * @property {boolean} right - True for the view on the right half of the screen.
 */

/**
 * Creates a camera rendering the scene into its own render target, with the selected depth
 * format, as the depth buffer of the back buffer has a fixed format.
 *
 * @param {string} name - The name of the camera.
 * @param {boolean} reverseZ - Whether the camera renders with reverse-z.
 * @param {boolean} right - True for the view on the right half of the screen.
 * @returns {View} The view.
 */
const createView = (name, reverseZ, right) => {
    const camera = new Entity(name);
    camera.addComponent('camera', {
        layers: [LAYERID_WORLD],
        clearColor: new Color(0.03, 0.05, 0.1),
        nearClip: 0.1,
        farClip: 1000000,

        // a horizontal field of view, so that each half of the screen shows all the panels
        fov: 80,
        horizontalFov: true,
        reverseZ
    });
    app.root.addChild(camera);
    return { camera, renderTarget: null, right };
};

// the standard depth on the left, and reverse-z on the right
const views = [createView('StandardCamera', false, false), createView('ReverseZCamera', true, true)];

// the camera displaying the render targets on the screen
const displayCamera = new Entity('DisplayCamera');
displayCamera.addComponent('camera', {
    layers: [LAYERID_UI],
    clearColor: new Color(0, 0, 0),
    priority: 1
});
app.root.addChild(displayCamera);

const textures = new TextureRenderer(app);
textures.layer = app.scene.layers.getLayerById(LAYERID_UI);
textures.camera = displayCamera.camera;

/**
 * @param {View} view - The view.
 */
const destroyRenderTarget = (view) => {
    if (view.renderTarget) {
        view.camera.camera.renderTarget = null;
        view.renderTarget.destroyTextureBuffers();
        view.renderTarget.destroy();
        view.renderTarget = null;
    }
};

/**
 * @param {View} view - The view.
 */
const createRenderTarget = (view) => {
    destroyRenderTarget(view);

    // half of the screen, a few pixels narrower to leave a gap between the views
    const width = Math.max(1, Math.floor(device.width / 2) - 2);
    const height = Math.max(1, device.height);
    const textureOptions = {
        width,
        height,
        mipmaps: false,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    };

    const colorBuffer = new Texture(device, {
        ...textureOptions,
        name: `${view.camera.name}-Color`,
        format: PIXELFORMAT_RGBA8,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR
    });

    // single sampled, so the camera renders into this depth buffer itself, see
    // CameraComponent#reverseZ
    const depthBuffer = new Texture(device, {
        ...textureOptions,
        name: `${view.camera.name}-Depth`,
        format: data.get('data.depthFormat'),
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST
    });

    view.renderTarget = new RenderTarget({
        name: view.camera.name,
        colorBuffer,
        depthBuffer,
        samples: 1
    });
    view.camera.camera.renderTarget = view.renderTarget;
};

const createRenderTargets = () => views.forEach(createRenderTarget);

// the titles of the two views, right above the panels, and a caption explaining what to look for at
// the bottom, leaving room on the left for the stats of the examples browser
const overlay = document.createElement('div');
overlay.style.cssText =
    'position:absolute;inset:0;pointer-events:none;color:#fff;font-family:sans-serif;' +
    'text-shadow:0 1px 3px rgba(0,0,0,0.9);';
document.body.appendChild(overlay);

// with the horizontal field of view of the cameras, the top of the upper row of panels is above the
// center of the screen by a fixed part of its width: tan(12.5) / tan(40) / 4, about 6.6%
const titles = document.createElement('div');
titles.style.cssText = 'position:absolute;left:0;right:0;bottom:calc(50% + 6.6vw + 12px);display:flex;';
overlay.appendChild(titles);

/**
 * @param {string} text - The title.
 * @returns {HTMLDivElement} The element showing the depth format under the title.
 */
const createTitle = (text) => {
    const title = document.createElement('div');
    title.style.cssText = 'flex:1;text-align:center;';
    title.innerHTML = `<div style="font-size:24px;font-weight:bold">${text}</div>`;
    const format = document.createElement('div');
    format.style.cssText = 'font-size:14px;opacity:0.8;margin-top:4px';
    title.appendChild(format);
    titles.appendChild(title);
    return format;
};
const formatLabels = [createTitle('Standard depth'), createTitle('Reverse-Z')];

const caption = document.createElement('div');
caption.style.cssText =
    'position:absolute;left:170px;right:24px;bottom:16px;text-align:center;font-size:14px;line-height:1.5;';
caption.innerHTML =
    'Each panel is a red square in front of a blue one: 1 m, 3 m, 10 m ... 300 m in the top row, ' +
    '1 km ... 300 km in the bottom row.<br>Where blue shows through the red, the depth buffer can ' +
    'no longer tell the two squares apart.';
overlay.appendChild(caption);

const depthFormatNames = {
    [PIXELFORMAT_DEPTH]: '32-bit float',
    [PIXELFORMAT_DEPTHSTENCIL]: '24-bit + stencil',
    [PIXELFORMAT_DEPTH16]: '16-bit fixed point'
};

const applySettings = () => {
    views.forEach((view) => {
        view.camera.camera.nearClip = data.get('data.nearClip');
    });

    const status = device.supportsReverseZ
        ? `${depthFormatNames[data.get('data.depthFormat')]} - left standard, right reverse-z`
        : 'reverse-z is not supported';
    if (data.get('data.status') !== status) {
        data.set('data.status', status);
    }

    const format = `${depthFormatNames[data.get('data.depthFormat')]} depth buffer`;
    formatLabels.forEach((label) => {
        label.textContent = format;
    });
};

data.set('data', {
    depthFormat: PIXELFORMAT_DEPTH,
    nearClip: 0.1,
    animate: true,
    status: ''
});

// registered after the initial values are set, as setting them fires an event for each value while
// the remaining values are still undefined
data.on('*:set', (/** @type {string} */ path) => {
    if (path === 'data.depthFormat') {
        createRenderTargets();
    }
    applySettings();
});

createRenderTargets();
applySettings();

device.on('resizecanvas', createRenderTargets);
app.on('destroy', () => {
    device.off('resizecanvas', createRenderTargets);
    views.forEach(destroyRenderTarget);
    overlay.remove();
});

// a slow sway of the view, which makes the z-fighting shimmer
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    if (data.get('data.animate')) {
        time += dt;
    }

    views.forEach((view) => {
        view.camera.setLocalEulerAngles(Math.sin(time * 0.4) * 1.5, Math.sin(time * 0.25) * 3, 0);
        if (view.renderTarget) {
            const width = view.renderTarget.width / device.width;
            textures.draw(view.renderTarget.colorBuffer, view.right ? 1 - width : 0, 0, width, 1);
        }
    });
});
