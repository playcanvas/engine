// @config
//
// The picker finds the objects inside each colored rectangle, and the object under the mouse, and
// highlights them. Left click to find the world space point under the mouse. Right click to stop the
// camera and orbit it yourself.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    BoundingBox,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LAYERID_IMMEDIATE,
    LAYERID_UI,
    LAYERID_WORLD,
    LightComponentSystem,
    MOUSEBUTTON_LEFT,
    MOUSEBUTTON_RIGHT,
    Mouse,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE,
    Picker,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF5_32F,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TextureRenderer,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

/**
 * @import { RenderComponent } from 'playcanvas'
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    envAtlas: new Asset(
        'env-atlas',
        'texture',
        { url: './assets/cubemaps/studio-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler];

const app = new AppBase(canvas);
app.init(createOptions);

const textures = new TextureRenderer(app);

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

// The studio environment gives the objects their reflections and a little ambient light. The camera
// does not render the skybox layer, so the background is the clear color.
app.scene.envAtlas = assets.envAtlas.resource;
app.scene.skyboxIntensity = 0.2;

// ----- The objects -----

// Neutral clay colors, so the highlight colors stand out
const PALETTE = ['#e6e1d8', '#bdb8b0', '#8e939b', '#5f656e', '#3c4149'].map((hex) => new Color().fromString(hex));
const SHAPES = /** @type {RenderComponent['type'][]} */ (['box', 'sphere', 'cylinder', 'capsule', 'cone', 'torus']);

/**
 * Creates an object with its own material, as the highlight changes the emissive color of the
 * material.
 *
 * @param {RenderComponent['type']} type - The primitive type.
 * @param {Color} color - The color.
 * @returns {Entity} The entity.
 */
function createObject(type, color) {
    const material = new StandardMaterial();
    material.diffuse = color;
    material.useMetalness = true;
    material.metalness = 0;
    material.gloss = 0.45;
    material.update();

    const entity = new Entity(type);
    entity.addComponent('render', { type, material });
    app.root.addChild(entity);
    return entity;
}

// Scatter the objects in a ball, with random shapes, colors, sizes and rotations
const radius = 16;
for (let i = 0; i < 300; i++) {
    const position = new Vec3();
    do {
        position.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    } while (position.lengthSq() > 1);

    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const entity = createObject(shape, PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    entity.setLocalPosition(position.mulScalar(radius));
    entity.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
    const scale = 0.8 + Math.random() * 0.8;
    entity.setLocalScale(scale, scale, scale);
}

// The marker shows the picked world point. It is not pickable itself.
const markerMaterial = new StandardMaterial();
markerMaterial.diffuse = Color.BLACK;
markerMaterial.emissive = new Color().fromString('#7dff6b');
markerMaterial.emissiveIntensity = 10;
markerMaterial.update();

const marker = new Entity('Marker');
marker.addComponent('render', { type: 'sphere', material: markerMaterial });
marker.render.meshInstances[0].pick = false;
marker.setLocalScale(0.35, 0.35, 0.35);
marker.enabled = false;
app.root.addChild(marker);

// ----- The camera -----

// The camera auto-orbits the scene until the first right-click, after which interactive orbit
// controls (drag to orbit, scroll to zoom) take over - letting the view be moved around to visually
// confirm culling. Left-click picks without stopping the orbit.
const camera = new Entity('Camera');
// the camera frame treats the clear color as a linear color, so it is converted from sRGB
camera.addComponent('camera', {
    clearColor: new Color().fromString('#171b23').linear(),
    layers: [LAYERID_WORLD, LAYERID_IMMEDIATE, LAYERID_UI]
});
camera.addComponent('script');
app.root.addChild(camera);

/**
 * Creates a directional light.
 *
 * @param {string} color - The color, as a hex string.
 * @param {number} intensity - The intensity.
 * @param {number[]} angles - The euler angles of the light, relative to the camera.
 * @returns {Entity} The entity.
 */
function createLight(color, intensity, angles) {
    const light = new Entity('Light');
    light.addComponent('light', {
        type: 'directional',
        color: new Color().fromString(color),
        intensity
    });
    light.setLocalEulerAngles(angles[0], angles[1], angles[2]);
    camera.addChild(light);
    return light;
}

// The lights are attached to the camera, so the lighting looks the same from every side: a warm key
// light from the upper left, its soft shadows fitted to the ball of objects, and a cool rim light from
// behind the objects, which outlines them against the background
const keyLight = createLight('#ffe0bd', 2.2, [50, -40, 0]);
keyLight.light.castShadows = true;
keyLight.light.shadowType = SHADOW_PCF5_32F;
keyLight.light.shadowResolution = 2048;
keyLight.light.shadowBias = 0.2;
keyLight.light.normalOffsetBias = 0.05;
keyLight.light.shadowBounds = new BoundingBox(Vec3.ZERO, new Vec3(18, 18, 18));
createLight('#7fa8ff', 1.6, [-50, -30, 0]);

// Auto-rotation is active until the first right-click; at that point we create CameraControls
// (which attaches at the camera's current pose, so there's no jump) and hand control to the
// user, never auto-rotating again
let autoRotate = true;
const stopAutoRotate = () => {
    if (!autoRotate) return;
    autoRotate = false;
    const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
    cameraControls.focusPoint = new Vec3(0, 0, 0);
};

data.on('orthoCamera:set', (/** @type {boolean} */ value) => {
    camera.camera.projection = value ? PROJECTION_ORTHOGRAPHIC : PROJECTION_PERSPECTIVE;
    camera.camera.orthoHeight = 15;

    // orthographic views have no depth cue, so keep what lies behind the camera visible
    camera.camera.nearClip = value ? -camera.camera.farClip : 0.1;
});

// The neutral tone mapping keeps the highlight colors, and the bloom makes them glow
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;
cameraFrame.bloom.intensity = 0.03;
cameraFrame.bloom.blurLevel = 5;
cameraFrame.vignette.intensity = 0.4;
cameraFrame.update();

// ----- The picker -----

// Use a quarter resolution for picker render target (faster but less precise - can miss small objects).
// The picker also renders depth, which the world point picking needs.
const pickerScale = 0.25;
const picker = new Picker(app, canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale, true);
const pickerLayers = [app.scene.layers.getLayerById(LAYERID_WORLD)];

/**
 * Creates an overlay element with a label.
 *
 * @param {string} css - The style of the element.
 * @param {string} labelCss - The style of the label.
 * @returns {{ element: HTMLDivElement, label: HTMLSpanElement }} The element and its label.
 */
function createOverlay(css, labelCss) {
    const element = document.createElement('div');
    element.style.cssText = `position: absolute; pointer-events: none; ${css}`;
    const label = document.createElement('span');
    label.style.cssText = `position: absolute; white-space: nowrap; font: 600 11px system-ui, sans-serif; ${labelCss}`;
    element.appendChild(label);
    document.body.appendChild(element);
    app.on('destroy', () => element.remove());
    return { element, label };
}

// The areas to find the objects in: three rectangles placed relative to the canvas size, shown with
// the number of objects they found, and the pixel under the mouse. Each area highlights the objects
// in it with its color.
const areas = [
    { x: 0.3, y: 0.3, width: 100, height: 200, color: '#ffb340', mouse: false },
    { x: 0.6, y: 0.7, width: 200, height: 20, color: '#38d9ff', mouse: false },
    { x: 0.6, y: 0.4, width: 16, height: 16, color: '#ff5ce1', mouse: false },
    { x: 0, y: 0, width: 1, height: 1, color: '#ff4d4d', mouse: true }
].map((area) => ({
    ...area,
    highlight: new Color().fromString(area.color),
    overlay: area.mouse
        ? null
        : createOverlay(
              `outline: 2px solid ${area.color}; border-radius: 3px; background: ${area.color}22; box-shadow: 0 0 14px ${area.color}88;`,
              `left: -2px; bottom: calc(100% + 6px); padding: 1px 6px; border-radius: 8px; background: ${area.color}; color: #15181e;`
          )
}));

// Captions above the previews of the picker's buffers, drawn in the bottom right corner: the color
// buffer, where each object is rendered with its id as its color, and the depth buffer
[
    { x: 72.5, caption: 'picker ids' },
    { x: 83.5, caption: 'picker depth' }
].forEach(({ x, caption }) => {
    const { label } = createOverlay(
        `left: ${x}%; top: 83.5%;`,
        'left: 0; bottom: 6px; color: #a7afbd; text-transform: uppercase; letter-spacing: 0.08em;'
    );
    label.textContent = caption;
});

// The object under the mouse is highlighted as the mouse moves. Left button picks a world point
// (auto-rotation continues, so the picked marker can be seen from a moving viewpoint), right button
// hands control to the user and stops the auto-rotation. The context menu is disabled so the right
// button is usable.
document.body.style.cursor = 'crosshair';
app.mouse.disableContextMenu();
app.mouse.on('mousemove', (event) => {
    areas.forEach((area) => {
        if (area.mouse) {
            area.x = event.x / canvas.clientWidth;
            area.y = event.y / canvas.clientHeight;
        }
    });
});

/** @type {{ x: number, y: number } | null} */
let pendingPickRequest = null;
app.mouse.on('mousedown', (event) => {
    if (event.button === MOUSEBUTTON_RIGHT) {
        stopAutoRotate();
    } else if (event.button === MOUSEBUTTON_LEFT) {
        // store the request to process after picker.prepare
        pendingPickRequest = { x: event.x * pickerScale, y: event.y * pickerScale };
    }
});

/**
 * Sets the emissive color of a material, which highlights it.
 *
 * @param {StandardMaterial} material - The material.
 * @param {Color} color - The color, black to remove the highlight.
 */
function highlightMaterial(material, color) {
    material.emissive = color;
    material.emissiveIntensity = 2;
    material.update();
}

/** @type {StandardMaterial[]} */
const highlights = [];

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    // Auto-orbit the camera until the user takes control
    if (autoRotate) {
        time += dt * 0.1;
        camera.setLocalPosition(40 * Math.sin(time), 0, 40 * Math.cos(time));
        camera.lookAt(Vec3.ZERO);
    }

    // Make sure the picker is the right size, and prepare it, which renders meshes into its render target
    picker.resize(canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);
    picker.prepare(camera.camera, app.scene, pickerLayers);

    // Get the list of mesh instances inside each area from the picker. This scans the pixels inside
    // the render target and maps the id value stored there into mesh instances. It is an async
    // function returning a promise.
    const promises = areas.map((area) => {
        const x = area.x * canvas.clientWidth;
        const y = area.y * canvas.clientHeight;

        // place the rectangle over the area
        if (area.overlay) {
            const style = area.overlay.element.style;
            style.left = `${x}px`;
            style.top = `${y}px`;
            style.width = `${area.width}px`;
            style.height = `${area.height}px`;
        }

        return picker.getSelectionAsync(
            x * pickerScale,
            y * pickerScale,
            area.width * pickerScale,
            area.height * pickerScale
        );
    });

    // When all promises are resolved, we can highlight the meshes
    Promise.all(promises).then((results) => {
        // Turn off previously highlighted meshes
        highlights.forEach((material) => highlightMaterial(material, Color.BLACK));
        highlights.length = 0;

        results.forEach((meshInstances, i) => {
            const area = areas[i];
            if (area.overlay) {
                area.overlay.label.textContent = `${meshInstances.length}`;
            }

            meshInstances.forEach((meshInstance) => {
                if (meshInstance) {
                    const material = /** @type {StandardMaterial} */ (meshInstance.material);
                    highlightMaterial(material, area.highlight);
                    highlights.push(material);
                }
            });
        });
    });

    // Process pending pick request after picker.prepare has been called
    if (pendingPickRequest) {
        const { x, y } = pendingPickRequest;
        pendingPickRequest = null;

        picker.getWorldPointAsync(x, y).then((worldPoint) => {
            marker.enabled = !!worldPoint;
            if (worldPoint) {
                marker.setPosition(worldPoint);
            }
        });
    }

    // Display the picker's buffers side by side in the bottom right corner
    // color buffer (left) and depth buffer (right), with equal margins from edges
    // @ts-expect-error the picker's buffers are internal, read here only to display them
    const { colorBuffer, depthBuffer } = picker;
    if (colorBuffer) {
        textures.draw(colorBuffer, 0.725, 0.835, 0.1, 0.1);
    }

    if (depthBuffer) {
        textures.draw(depthBuffer, 0.835, 0.835, 0.1, 0.1);
    }
});
