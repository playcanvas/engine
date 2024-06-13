// @config ENGINE performance
// @config NO_MINISTATS
// @config WEBGPU_DISABLED
import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.ModelComponentSystem,
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem
];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// set up options for mini-stats, start with the default options
const options = pc.MiniStats.getDefaultOptions();

// configure sizes
options.sizes = [
    { width: 128, height: 16, spacing: 0, graphs: false },
    { width: 256, height: 32, spacing: 2, graphs: true },
    { width: 500, height: 64, spacing: 2, graphs: true }
];

// when the application starts, use the largest size
options.startSizeIndex = 2;

// display additional counters
// Note: for most of these to report values, either debug or profiling engine build needs to be used.
options.stats = [
    // frame update time in ms
    {
        name: 'Update',
        stats: ['frame.updateTime'],
        decimalPlaces: 1,
        unitsName: 'ms',
        watermark: 33
    },

    // total number of draw calls
    {
        name: 'DrawCalls',
        stats: ['drawCalls.total'],
        watermark: 2000
    },

    // total number of triangles, in 1000s
    {
        name: 'triCount',
        stats: ['frame.triangles'],
        decimalPlaces: 1,
        multiplier: 1 / 1000,
        unitsName: 'k',
        watermark: 500
    },

    // number of materials used in a frame
    {
        name: 'materials',
        stats: ['frame.materials'],
        watermark: 2000
    },

    // frame time it took to do frustum culling
    {
        name: 'cull',
        stats: ['frame.cullTime'],
        decimalPlaces: 1,
        watermark: 1,
        unitsName: 'ms'
    },

    // used VRAM, displayed using 2 colors - red for textures, green for geometry
    {
        name: 'VRAM',
        stats: ['vram.tex', 'vram.geom'],
        decimalPlaces: 1,
        multiplier: 1 / (1024 * 1024),
        unitsName: 'MB',
        watermark: 100
    },

    // frames per second
    {
        name: 'FPS',
        stats: ['frame.fps'],
        watermark: 60
    },

    // delta time
    {
        name: 'Frame',
        stats: ['frame.ms'],
        decimalPlaces: 1,
        unitsName: 'ms',
        watermark: 33
    }
];

// create mini-stats system
const miniStats = new pc.MiniStats(app, options); // eslint-disable-line no-unused-vars

// add directional lights to the scene
const light = new pc.Entity();
light.addComponent('light', {
    type: 'directional'
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

// Create an entity with a camera component
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1)
});
app.root.addChild(camera);
camera.setLocalPosition(20, 10, 10);
camera.lookAt(pc.Vec3.ZERO);

/**
 * Helper function to create a primitive with shape type, position, scale.
 *
 * @param {string} primitiveType - The primitive type.
 * @param {number | pc.Vec3} position - The position.
 * @param {number | pc.Vec3} scale - The scale.
 * @returns {pc.Entity} The new primitive entity.
 */
function createPrimitive(primitiveType, position, scale) {
    // create material of random color
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
    material.update();

    // create primitive
    const primitive = new pc.Entity();
    primitive.addComponent('model', {
        type: primitiveType
    });
    primitive.model.material = material;

    // set position and scale
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);

    return primitive;
}

// list of all created engine resources
/** @type {pc.Entity[]} */
const entities = [];
/** @type {any[]} */
const vertexBuffers = [];
/** @type {any[]} */
const textures = [];

// update function called every frame
let adding = true;
const step = 10,
    max = 2000;
/** @type {pc.Entity} */
let entity;
/** @type {pc.VertexBuffer} */
let vertexBuffer;
/** @type {{ destroy: () => void}} */
let texture;
app.on('update', function () {
    // execute some tasks multiple times per frame
    for (let i = 0; i < step; i++) {
        // allocating resources
        if (adding) {
            // add entity (they used shared geometry internally, and we create individual material for each)
            const shape = Math.random() < 0.5 ? 'box' : 'sphere';
            const position = new pc.Vec3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
            const scale = 0.5 + Math.random();
            entity = createPrimitive(shape, position, new pc.Vec3(scale, scale, scale));
            entities.push(entity);
            app.root.addChild(entity);

            // if allocation reached the max limit, switch to removing mode
            if (entities.length >= max) {
                adding = false;
            }

            // add vertex buffer
            const vertexCount = 500;
            const data = new Float32Array(vertexCount * 16);
            const format = pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice);
            vertexBuffer = new pc.VertexBuffer(app.graphicsDevice, format, vertexCount, {
                data: data
            });
            vertexBuffers.push(vertexBuffer);

            // allocate texture
            const texture = new pc.Texture(app.graphicsDevice, {
                width: 64,
                height: 64,
                format: pc.PIXELFORMAT_RGB8,
                mipmaps: false
            });
            textures.push(texture);

            // ensure texture is uploaded (actual VRAM is allocated)
            texture.lock();
            texture.unlock();

            if (!app.graphicsDevice.isWebGPU) {
                // @ts-ignore engine-tsd
                app.graphicsDevice.setTexture(texture, 0);
            }
        } else {
            // de-allocating resources

            if (entities.length > 0) {
                // destroy entities
                entity = entities[entities.length - 1];
                // @ts-ignore engine-tsd
                entity.destroy();
                entities.length--;

                // destroy vertex buffer
                vertexBuffer = vertexBuffers[vertexBuffers.length - 1];
                vertexBuffer.destroy();
                vertexBuffers.length--;

                // destroy texture
                texture = textures[textures.length - 1];
                texture.destroy();
                textures.length--;
            } else {
                adding = true;
            }
        }
    }
});

export { app };
