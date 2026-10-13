import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_LINEAR,
    Keyboard,
    Layer,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGB8,
    PROJECTION_ORTHOGRAPHIC,
    ParticleSystemComponentSystem,
    RENDERTARGET_ORIGIN_TOP,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    RenderTarget,
    ScriptComponentSystem,
    ScriptHandler,
    StandardMaterial,
    Texture,
    TextureHandler,
    TouchDevice,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.keyboard = new Keyboard(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    ParticleSystemComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ScriptHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

/**
 * helper function to create a primitive with shape type, position, scale, color and layer
 * @param {string} primitiveType - The primitive type.
 * @param {number | Vec3} position - The entity's position.
 * @param {number | Vec3} scale - The entity's scale.
 * @param {number[]} layer - The render component's layers.
 * @param {StandardMaterial} material - The render component's material.
 * @returns {Entity} The returned entity.
 */
function createPrimitive(primitiveType, position, scale, layer, material) {
    // Create primitive
    const primitive = new Entity(`Brush-${primitiveType}`);
    primitive.addComponent('render', {
        type: primitiveType,
        layers: layer,
        material: material,
        castShadows: false,
        receiveShadows: false
    });

    // Set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);

    return primitive;
}

// Create texture and render target for rendering into
const texture = new Texture(app.graphicsDevice, {
    width: 1024,
    height: 1024,
    format: PIXELFORMAT_RGB8,
    mipmaps: false,
    minFilter: FILTER_LINEAR,
    magFilter: FILTER_LINEAR
});
const renderTarget = new RenderTarget({
    colorBuffer: texture,
    depth: false,
    origin: RENDERTARGET_ORIGIN_TOP
});

// Create a layer for rendering to texture, and add it to the beginning of layers to render into it first
const paintLayer = new Layer({ name: 'paintLayer' });
app.scene.layers.insert(paintLayer, 0);

// Create a material we use for the paint brush - it uses emissive color to control its color, which is assigned later
const brushMaterial = new StandardMaterial();
brushMaterial.useLighting = false;
brushMaterial.update();

/**
 * we render multiple brush imprints each frame to make smooth lines, and set up pool to reuse them each frame
 * @type {Entity[]}
 */
const brushes = [];
function getBrush() {
    /** @type {Entity} */
    let brush;
    if (brushes.length === 0) {
        // Create new brush - use sphere primitive, but could use plane with a texture as well
        // Note: plane would need to be rotated by -90 degrees along x-axis to face camera and be visible
        brush = createPrimitive('sphere', new Vec3(2, 1, 0), new Vec3(1, 1, 1), [paintLayer.id], brushMaterial);
    } else {
        // Reuse already allocated brush
        brush = brushes.pop();
        brush.enabled = true;
    }
    return brush;
}

// Create orthographic camera, which renders brushes in paintLayer, and renders before the main camera
const paintCamera = new Entity();
paintCamera.addComponent('camera', {
    clearColorBuffer: false,
    projection: PROJECTION_ORTHOGRAPHIC,
    layers: [paintLayer.id],
    renderTarget: renderTarget,
    priority: -1
});

// Make it look at the center of the render target, some distance away
paintCamera.setLocalPosition(0, 0, -10);
paintCamera.lookAt(Vec3.ZERO);
app.root.addChild(paintCamera);

// Create main camera, which renders entities in world layer - this is where we show the render target on the box
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.2, 0.2, 0.2)
});
camera.translate(0, 0, 30);
camera.lookAt(Vec3.ZERO);
app.root.addChild(camera);

// Material used to add render target into the world
const material = new StandardMaterial();
material.name = 'EmissiveMaterial';
material.emissiveMap = texture;
material.emissive = Color.WHITE;
material.useLighting = false;
material.update();

// Create a box which we use to display rendered texture in the world layer
const worldLayer = app.scene.layers.getLayerByName('World');
const box = createPrimitive('box', new Vec3(0, 0, 0), new Vec3(15, 15, 15), [worldLayer.id], material);

let progress = 1;
/** @type {number | undefined} */
let scale;
/** @type {Vec3 | undefined} */
let startPos;
/** @type {Vec3 | undefined} */
let endPos;
const pos = new Vec3();
/** @type {Entity[]} */
const usedBrushes = [];

// Update things each frame
app.on('update', (dt) => {
    // If the last brush stroke is finished, generate new random one
    if (progress >= 1) {
        progress = 0;

        // Generate start and end position for the stroke
        startPos = new Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, 0);
        endPos = new Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, 0);

        // Random width (scale)
        scale = 0.1 + Math.random();

        // Assign random color to the brush
        brushMaterial.emissive = new Color(Math.random(), Math.random(), Math.random());
        brushMaterial.update();
    }

    // Disable brushes from the previous frame and return them to the free pool
    while (usedBrushes.length > 0) {
        const brush = usedBrushes.pop();
        brush.enabled = false;
        brushes.push(brush);
    }

    // Step along the brush line multiple times each frame to make the line smooth
    const stepCount = 30;
    const stepProgress = 0.005;

    // In each step
    for (let i = 0; i < stepCount; i++) {
        // Move position little bit
        pos.lerp(startPos, endPos, progress);

        // Setup brush to be rendered this frame
        const activeBrush = getBrush();
        activeBrush.setLocalPosition(pos);
        activeBrush.setLocalScale(scale, scale, scale);
        usedBrushes.push(activeBrush);

        // Progress for the next step
        progress += stepProgress;
    }

    // Rotate the box in the world
    box.rotate(5 * dt, 10 * dt, 15 * dt);
});
