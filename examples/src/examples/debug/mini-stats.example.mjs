// @config
// @flag ENGINE=performance
// @flag NO_MINISTATS
// @flag WEBGPU_DISABLED

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    MiniStats,
    ModelComponentSystem,
    PIXELFORMAT_RGB8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    Texture,
    Vec3,
    VertexBuffer,
    VertexFormat,
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

createOptions.componentSystems = [
    ModelComponentSystem,
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem
];

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

// Set up options for mini-stats, start with the default options
const options = MiniStats.getDefaultOptions();

// Configure sizes
options.sizes = [
    { width: 128, height: 16, spacing: 0, graphs: false },
    { width: 256, height: 32, spacing: 2, graphs: true },
    { width: 500, height: 64, spacing: 2, graphs: true }
];

// When the application starts, use the largest size
options.startSizeIndex = 2;

// Display additional counters
// Note: for most of these to report values, either debug or profiling engine build needs to be used.
options.stats = [
    // Frame update time in ms
    {
        name: 'Update',
        stats: ['frame.updateTime'],
        decimalPlaces: 1,
        unitsName: 'ms',
        watermark: 33
    },

    // Total number of draw calls
    {
        name: 'DrawCalls',
        stats: ['drawCalls.total'],
        watermark: 2000
    },

    // Total number of triangles, in 1000s
    {
        name: 'triCount',
        stats: ['frame.triangles'],
        decimalPlaces: 1,
        multiplier: 1 / 1000,
        unitsName: 'k',
        watermark: 500
    },

    // Number of materials used in a frame
    {
        name: 'materials',
        stats: ['frame.materials'],
        watermark: 2000
    },

    // Frame time it took to do frustum culling
    {
        name: 'cull',
        stats: ['frame.cullTime'],
        decimalPlaces: 1,
        watermark: 1,
        unitsName: 'ms'
    },

    // Used VRAM in MB
    {
        name: 'VRAM',
        stats: ['vram.totalUsed'],
        decimalPlaces: 1,
        multiplier: 1 / (1024 * 1024),
        unitsName: 'MB',
        watermark: 100
    },

    // Frames per second
    {
        name: 'FPS',
        stats: ['frame.fps'],
        watermark: 60
    },

    // Delta time
    {
        name: 'Frame',
        stats: ['frame.ms'],
        decimalPlaces: 1,
        unitsName: 'ms',
        watermark: 33
    }
];

// Create mini-stats system
const miniStats = new MiniStats(app, options); // eslint-disable-line no-unused-vars

// Add directional lights to the scene
const light = new Entity();
light.addComponent('light', {
    type: 'directional'
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

// Create an entity with a camera component
const camera = new Entity();
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);
camera.setLocalPosition(20, 10, 10);
camera.lookAt(Vec3.ZERO);

/**
 * Helper function to create a primitive with shape type, position, scale.
 *
 * @param {string} primitiveType - The primitive type.
 * @param {number | Vec3} position - The position.
 * @param {number | Vec3} scale - The scale.
 * @returns {Entity} The new primitive entity.
 */
function createPrimitive(primitiveType, position, scale) {
    // Create material of random color
    const material = new StandardMaterial();
    material.diffuse = new Color(Math.random(), Math.random(), Math.random());
    material.update();

    // Create primitive
    const primitive = new Entity();
    primitive.addComponent('model', {
        type: primitiveType
    });
    primitive.model.material = material;

    // Set position and scale
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);

    return primitive;
}

// List of all created engine resources
/** @type {Entity[]} */
const entities = [];
/** @type {any[]} */
const vertexBuffers = [];
/** @type {any[]} */
const textures = [];

// Update function called every frame
let adding = true;
const step = 10,
    max = 2000;
/** @type {Entity} */
let entity;
/** @type {VertexBuffer} */
let vertexBuffer;
/** @type {{ destroy: () => void}} */
let texture;
app.on('update', () => {
    // Execute some tasks multiple times per frame
    for (let i = 0; i < step; i++) {
        // Allocating resources
        if (adding) {
            // Add entity (they used shared geometry internally, and we create individual material for each)
            const shape = Math.random() < 0.5 ? 'box' : 'sphere';
            const position = new Vec3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
            const scale = 0.5 + Math.random();
            entity = createPrimitive(shape, position, new Vec3(scale, scale, scale));
            entities.push(entity);
            app.root.addChild(entity);

            // If allocation reached the max limit, switch to removing mode
            if (entities.length >= max) {
                adding = false;
            }

            // Add vertex buffer
            const vertexCount = 500;
            const data = new Float32Array(vertexCount * 16);
            const format = VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
            vertexBuffer = new VertexBuffer(app.graphicsDevice, format, vertexCount, {
                data: data
            });
            vertexBuffers.push(vertexBuffer);

            // Allocate texture
            const texture = new Texture(app.graphicsDevice, {
                width: 64,
                height: 64,
                format: PIXELFORMAT_RGB8,
                mipmaps: false
            });
            textures.push(texture);

            // Ensure texture is uploaded (actual VRAM is allocated)
            texture.lock();
            texture.unlock();

            if (!app.graphicsDevice.isWebGPU) {
                // @ts-ignore engine-tsd
                app.graphicsDevice.setTexture(texture, 0);
            }
        } else {
            // De-allocating resources

            if (entities.length > 0) {
                // Destroy entities
                entity = entities[entities.length - 1];
                // @ts-ignore engine-tsd
                entity.destroy();
                entities.length--;

                // Destroy vertex buffer
                vertexBuffer = vertexBuffers[vertexBuffers.length - 1];
                vertexBuffer.destroy();
                vertexBuffers.length--;

                // Destroy texture
                texture = textures[textures.length - 1];
                texture.destroy();
                textures.length--;
            } else {
                adding = true;
            }
        }
    }
});
