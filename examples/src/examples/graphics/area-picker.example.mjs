// @config
//
// Click on objects to detect world space intersection. Objects within the colored rectangles are
// highlighted.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    MOUSEBUTTON_LEFT,
    MOUSEBUTTON_RIGHT,
    Mouse,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE,
    Picker,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler];

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

// Setup skydome
app.scene.skyboxMip = 2;
app.scene.envAtlas = assets.helipad.resource;
app.scene.skyboxIntensity = 0.1;

// Use a quarter resolution for picker render target (faster but less precise - can miss small objects)
const pickerScale = 0.25;
let mouseX = 0,
    mouseY = 0;

// Generate a box area with specified size of random primitives
const size = 30;
const halfSize = size * 0.5;
for (let i = 0; i < 300; i++) {
    const shape = Math.random() < 0.5 ? 'cylinder' : 'sphere';
    const position = new Vec3(
        Math.random() * size - halfSize,
        Math.random() * size - halfSize,
        Math.random() * size - halfSize
    );
    const scale = 1 + Math.random();
    const entity = createPrimitive(shape, position, new Vec3(scale, scale, scale));
    app.root.addChild(entity);
}

// Handle mouse move event and store current mouse position to use as a position to pick from the scene
new Mouse(document.body).on(
    'mousemove',
    (event) => {
        mouseX = event.x;
        mouseY = event.y;
    },
    this
);

// Create an instance of the picker class
// Let's use quarter of the resolution to improve performance - this will miss very small objects, but it's ok in our case
const picker = new Picker(app, canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale, true);

/**
 * Helper function to create a primitive with shape type, position, scale.
 *
 * @param {string} primitiveType - The primitive type.
 * @param {Vec3} position - The position.
 * @param {Vec3} scale - The scale.
 * @returns {Entity} The returned entity.
 */
function createPrimitive(primitiveType, position, scale) {
    // Create material of random color
    const material = new StandardMaterial();
    material.diffuse = new Color(Math.random(), Math.random(), Math.random());
    material.gloss = 0.6;
    material.metalness = 0.4;
    material.useMetalness = true;
    material.update();

    // Create primitive
    const primitive = new Entity();
    primitive.addComponent('render', {
        type: primitiveType,
        material: material
    });

    // Set position and scale
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);

    return primitive;
}

// Create main camera. It auto-orbits the scene until the first right-click, after which
// interactive orbit controls (drag to orbit, scroll to zoom) take over - letting the view be
// moved around to visually confirm culling. Left-click picks without stopping the orbit.
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
camera.addComponent('script');
app.root.addChild(camera);

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
});

// ------ Custom render passes with bloom ------
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.bloom.intensity = 0.01;
cameraFrame.bloom.blurLevel = 4;
cameraFrame.update();

/**
 * Function to draw a 2D rectangle in the screen space coordinates.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} w - The width.
 * @param {number} h - The height.
 */
function drawRectangle(x, y, w, h) {
    const pink = new Color(1, 0.02, 0.58);

    // Transform 4 2D screen points into world space
    const pt0 = camera.camera.screenToWorld(x, y, 1);
    const pt1 = camera.camera.screenToWorld(x + w, y, 1);
    const pt2 = camera.camera.screenToWorld(x + w, y + h, 1);
    const pt3 = camera.camera.screenToWorld(x, y + h, 1);

    // And connect them using white lines
    const points = [pt0, pt1, pt1, pt2, pt2, pt3, pt3, pt0];
    const colors = [pink, pink, pink, pink, pink, pink, pink, pink];
    app.drawLines(points, colors);
}

/**
 * Sets material emissive color to specified color.
 *
 * @param {StandardMaterial} material - The material to highlight.
 * @param {Color} color - The color to highlight with.
 */
function highlightMaterial(material, color) {
    material.emissive = color;
    material.emissiveIntensity = 30;
    material.update();
}

// Array of highlighted materials
/** @type {StandardMaterial[]} */
const highlights = [];

// The layers picker renders
const worldLayer = app.scene.layers.getLayerByName('World');
const pickerLayers = [worldLayer];

// Marker sphere to show the picked world point
const marker = createPrimitive('sphere', Vec3.ZERO, new Vec3(0.2, 0.2, 0.2));
const markerMaterial = new StandardMaterial();
markerMaterial.emissive = new Color(0, 1, 0);
markerMaterial.emissiveIntensity = 100;
marker.render.material = markerMaterial;
marker.render.meshInstances[0].pick = false;
marker.enabled = false;
app.root.addChild(marker);

// Store pending pick request
/** @type {{ x: number, y: number } | null} */
let pendingPickRequest = null;

// Handle mouse buttons: left button picks a world point (auto-rotation continues, so the picked
// marker can be seen from a moving viewpoint), right button hands control to the user and stops
// the auto-rotation. The context menu is disabled so the right button is usable.
const mouse = new Mouse(document.body);
mouse.disableContextMenu();
mouse.on('mousedown', (event) => {
    if (event.button === MOUSEBUTTON_RIGHT) {
        // Right button stops the auto-rotation and hands control to the user
        stopAutoRotate();
    } else if (event.button === MOUSEBUTTON_LEFT) {
        // Left button picks a world point; store the request to process after picker.prepare
        pendingPickRequest = {
            x: event.x * pickerScale,
            y: event.y * pickerScale
        };
    }
});

// Update each frame
let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    // Auto-orbit the camera until the user takes control
    if (autoRotate) {
        time += dt * 0.1;
        camera.setLocalPosition(40 * Math.sin(time), 0, 40 * Math.cos(time));
        camera.lookAt(Vec3.ZERO);
    }

    // Make sure the picker is the right size, and prepare it, which renders meshes into its render target
    if (picker) {
        picker.resize(canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);
        picker.prepare(camera.camera, app.scene, pickerLayers);
    }

    // Areas we want to sample - two larger rectangles, one small square, and one pixel at a mouse position
    // assign them different highlight colors as well
    const areas = [
        {
            pos: new Vec2(canvas.clientWidth * 0.3, canvas.clientHeight * 0.3),
            size: new Vec2(100, 200),
            color: Color.YELLOW
        },
        {
            pos: new Vec2(canvas.clientWidth * 0.6, canvas.clientHeight * 0.7),
            size: new Vec2(200, 20),
            color: Color.CYAN
        },
        {
            pos: new Vec2(canvas.clientWidth * 0.8, canvas.clientHeight * 0.3),
            size: new Vec2(5, 5),
            color: Color.MAGENTA
        },
        {
            // Area based on mouse position
            pos: new Vec2(mouseX, mouseY),
            size: new Vec2(1, 1),
            color: Color.RED
        }
    ];

    // Process all areas every frame
    const promises = [];
    for (let a = 0; a < areas.length; a++) {
        const areaPos = areas[a].pos;
        const areaSize = areas[a].size;

        // Display 2D rectangle around it
        drawRectangle(areaPos.x, areaPos.y, areaSize.x, areaSize.y);

        // Get list of meshInstances inside the area from the picker
        // This scans the pixels inside the render target and maps the id value stored there into meshInstances
        // Note that this is an async function returning a promise. Store it in the promises array.
        const promise = picker.getSelectionAsync(
            areaPos.x * pickerScale,
            areaPos.y * pickerScale,
            areaSize.x * pickerScale,
            areaSize.y * pickerScale
        );

        promises.push(promise);
    }

    // When all promises are resolved, we can highlight the meshes
    Promise.all(promises).then((results) => {
        // Turn off previously highlighted meshes
        for (let h = 0; h < highlights.length; h++) {
            highlightMaterial(highlights[h], Color.BLACK);
            // Reset emissive intensity when turning off
            highlights[h].emissiveIntensity = 0;
        }
        highlights.length = 0;

        // Process the results
        for (let i = 0; i < results.length; i++) {
            const meshInstances = results[i];

            for (let s = 0; s < meshInstances.length; s++) {
                if (meshInstances[s]) {
                    /** @type {StandardMaterial} */
                    const material = meshInstances[s].material;
                    highlightMaterial(material, areas[i].color);
                    highlights.push(material);
                }
            }
        }
    });

    // Process pending pick request after picker.prepare has been called
    if (pendingPickRequest && picker) {
        const { x, y } = pendingPickRequest;
        pendingPickRequest = null;

        picker.getWorldPointAsync(x, y).then((worldPoint) => {
            if (worldPoint) {
                marker.enabled = true;
                marker.setPosition(worldPoint);
            } else {
                marker.enabled = false;
            }
        });
    }

    // Display the picker's buffers side by side in the bottom right corner
    // color buffer (left) and depth buffer (right), with equal margins from edges
    if (picker.colorBuffer) {
        // @ts-ignore engine-tsd
        app.drawTexture(0.55, -0.77, 0.2, 0.2, picker.colorBuffer);
    }

    if (picker.depthBuffer) {
        // @ts-ignore engine-tsd
        app.drawTexture(0.77, -0.77, 0.2, 0.2, picker.depthBuffer);
    }
});
