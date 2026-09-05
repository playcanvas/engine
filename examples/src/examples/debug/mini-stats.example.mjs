// @config
// @flag ENGINE=performance
//
// Watch a field of objects build and dissolve as entities, materials, vertex buffers and textures
// are allocated and released. Click the MiniStats panel to cycle through its three views.

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    MiniStats,
    PIXELFORMAT_RGB8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    Texture,
    TONEMAP_ACES,
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

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];

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

// Click the overlay to cycle between core counters, grouped averages and graph history.
// Panel width and row height can be customized independently for each mode.
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

    // Total number of primitives, in 1000s (debug / profiler builds)
    {
        name: 'Primitives',
        stats: ['primitiveCount'],
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
const miniStats = new MiniStats(app, options);

const step = 10;
const max = 2000;

// A limited palette and a regular silhouette make the changing workload easy to follow.
const palette = [
    new Color(0.52, 0.8, 0.86),
    new Color(0.32, 0.76, 0.79),
    new Color(0.17, 0.54, 0.69),
    new Color(0.28, 0.39, 0.63),
    new Color(0.51, 0.47, 0.68)
];
const accent = new Color(0.96, 0.66, 0.39);
app.scene.ambientLight = new Color(0.2, 0.24, 0.3);

const light = new Entity('Key light');
light.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.94, 0.86),
    intensity: 1.15,
    castShadows: false
});
light.setLocalEulerAngles(45, 25, 0);
app.root.addChild(light);

const fill = new Entity('Cool fill');
fill.addComponent('light', {
    type: 'directional',
    color: new Color(0.57, 0.74, 1),
    intensity: 0.5,
    castShadows: false
});
fill.setLocalEulerAngles(-20, -120, 0);
app.root.addChild(fill);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.055, 0.08, 0.115),
    toneMapping: TONEMAP_ACES,
    fov: 42,
    nearClip: 0.1,
    farClip: 100
});
app.root.addChild(camera);

// Keep the large stats view legible beside the sculpture, including on portrait screens.
let orbit = 0.5;
let cameraDistance = 19;
let cameraTargetX = -1.8;
let cameraTargetY = 5.2;
const frameScene = () => {
    camera.setLocalPosition(Math.sin(orbit) * cameraDistance, 8.8, Math.cos(orbit) * cameraDistance);
    camera.lookAt(cameraTargetX, cameraTargetY, 0);
};
const fitScene = () => {
    const aspect = device.width / device.height;
    cameraDistance = Math.max(19, (aspect < 0.6 ? 18 : 16) / aspect);
    cameraTargetX = aspect < 0.6 ? 0 : -1.8;
    cameraTargetY = aspect < 0.6 ? -1.5 : 5.2;
    frameScene();
};
device.on('resizecanvas', fitScene);
fitScene();

// This small DOM readout changes four times a second, independently of the per-frame workload.
const status = document.createElement('div');
status.className = 'resource-cycle';
status.innerHTML = `
    <div class="resource-cycle-label">RESOURCE CYCLE</div>
    <div class="resource-cycle-phase">Building</div>
    <div class="resource-cycle-count">0 <span>/ 2,000 objects</span></div>
    <div class="resource-cycle-track"><div class="resource-cycle-progress"></div></div>
    <div class="resource-cycle-hint">Entities, vertex buffers &amp; textures<br>Added and released, 10 per frame.</div>
`;
const style = document.createElement('style');
style.textContent = `
    .resource-cycle {
        position: fixed; top: 28px; right: 28px; width: 224px;
        color: #e1edf3; font-family: system-ui, sans-serif; pointer-events: none;
    }
    .resource-cycle-label { color: #8296a6; font-size: 10px; letter-spacing: 0.14em; }
    .resource-cycle-phase { margin-top: 12px; font-size: 30px; font-weight: 500; letter-spacing: -0.04em; }
    .resource-cycle-count { margin-top: 5px; font-size: 15px; font-variant-numeric: tabular-nums; }
    .resource-cycle-count span { color: #8296a6; font-size: 12px; }
    .resource-cycle-track { height: 2px; margin: 16px 0 12px; background: #243441; }
    .resource-cycle-progress { height: 100%; background: #69c6cd; transform: scaleX(0); transform-origin: left; }
    .resource-cycle-hint { color: #8296a6; font-size: 11px; line-height: 1.7; }
    .resource-cycle[data-releasing] .resource-cycle-progress { background: #eaa86b; }
    @media (max-width: 600px) {
        .resource-cycle { top: 20px; right: 18px; width: 188px; }
        .resource-cycle-phase { font-size: 25px; }
        .resource-cycle-hint { display: none; }
    }
`;
document.head.appendChild(style);
document.body.appendChild(status);
const phaseLabel = status.querySelector('.resource-cycle-phase');
const countLabel = status.querySelector('.resource-cycle-count');
const progress = /** @type {HTMLElement} */ (status.querySelector('.resource-cycle-progress'));
const numberFormat = new Intl.NumberFormat('en-US');

/**
 * Create one object on a Fibonacci sphere. Keep a distinct material per object so the material
 * and draw-call counters still reflect the original allocation workload.
 *
 * @param {number} index - Position in the allocation cycle.
 * @returns {Entity} The new primitive entity.
 */
function createPrimitive(index) {
    const material = new StandardMaterial();
    material.diffuse.copy(index % 29 < 2 ? accent : palette[Math.floor((index / max) * palette.length)]);
    material.useMetalness = true;
    material.metalness = 0.05;
    material.gloss = 0.45;
    material.update();

    const primitive = new Entity('Resource');
    primitive.addComponent('render', {
        type: index % 2 === 0 ? 'box' : 'sphere',
        material,
        castShadows: false,
        receiveShadows: false
    });

    const height = 1 - (2 * (index + 0.5)) / max;
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = 4 * Math.sqrt(1 - height * height);
    primitive.setLocalPosition(Math.cos(angle) * radius, 4.7 + height * 4, Math.sin(angle) * radius);
    const scale = index % 2 === 0 ? 0.27 : 0.34;
    primitive.setLocalScale(scale, scale, scale);
    primitive.setLocalEulerAngles((index % 3) * 15, (angle * 180) / Math.PI, 0);
    return primitive;
}

// List of all created engine resources
/** @type {Entity[]} */
const entities = [];
/** @type {VertexBuffer[]} */
const vertexBuffers = [];
/** @type {Texture[]} */
const textures = [];

// Update function called every frame
let adding = true;
/** @type {Entity} */
let entity;
/** @type {VertexBuffer} */
let vertexBuffer;
/** @type {Texture} */
let texture;
let statusTime = 0;
app.on('update', (dt) => {
    orbit += dt * 0.06;
    frameScene();

    // Execute some tasks multiple times per frame
    for (let i = 0; i < step; i++) {
        // Allocating resources
        if (adding) {
            // Add entity (they used shared geometry internally, and we create individual material for each)
            entity = createPrimitive(entities.length);
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
                const material = entity.render.material;
                entity.destroy();
                material.destroy();
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

    statusTime += dt;
    if (statusTime >= 0.25) {
        statusTime = 0;
        phaseLabel.textContent = adding ? 'Building' : 'Releasing';
        countLabel.firstChild.textContent = `${numberFormat.format(entities.length)} `;
        progress.style.transform = `scaleX(${entities.length / max})`;
        status.toggleAttribute('data-releasing', !adding);
    }
});

app.on('destroy', () => {
    device.off('resizecanvas', fitScene);
    for (const item of entities) item.render.material.destroy();
    for (const buffer of vertexBuffers) buffer.destroy();
    for (const item of textures) item.destroy();
    status.remove();
    style.remove();
});

export { miniStats };
