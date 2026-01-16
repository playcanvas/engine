// @config DESCRIPTION A static GSplatContainer with custom data format, rendered as multiple instances. Per-instance color tints are animated via shader uniforms using setParameter.
import { deviceType } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [];

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

app.start();

// Grid bounds for position denormalization
const gridSize = 10;
const posScale = (gridSize / 2) * 0.5;  // positions range from -posScale to +posScale

// Create custom format with single RGBA8 texture (RGB=normalized position, A=brightness)
// and custom uTint/uTint2 uniforms for per-instance color gradient
const format = new pc.GSplatFormat(device, [
    // this line gives us 'loadData' function in the shader, returning vec4
    { name: 'data', format: pc.PIXELFORMAT_RGBA8 }
], {
    // Declarations: add two tint uniforms for gradient
    declarationsGLSL: `
        uniform vec3 uTint;
        uniform vec3 uTint2;
    `,
    declarationsWGSL: `
        uniform uTint: vec3f;
        uniform uTint2: vec3f;
    `,
    // Read code: denormalize position and lerp between tints based on pre-baked brightness
    readGLSL: `
        // use generated load function to get the data from textures
        vec4 splatData = loadData();

        // evaluate center, color, scale, and rotation of the splat
        splatCenter = (splatData.rgb - 0.5) * ${(posScale * 2.0).toFixed(1)};
        vec3 tint = mix(uTint2, uTint, splatData.a);
        splatColor = vec4(tint, 1.0);
        splatScale = vec3(0.15);
        splatRotation = vec4(0.0, 0.0, 0.0, 1.0);
    `,
    readWGSL: `
        let splatData = loadData();
        splatCenter = (splatData.rgb - 0.5) * ${(posScale * 2.0).toFixed(1)};
        let tint = mix(uniform.uTint2, uniform.uTint, splatData.a);
        splatColor = vec4f(tint, 1.0);
        splatScale = vec3f(0.15);
        splatRotation = vec4f(0.0, 0.0, 0.0, 1.0);
    `
});

// Create container
const numSplats = gridSize ** 3;
const container = new pc.GSplatContainer(device, numSplats, format);

// Fill data texture (RGBA8: RGB=normalized position 0-1, A=brightness 0-1)
const data = container.getTexture('data').lock();
// Fill centers array for sorting (Float32Array with xyz per splat)
const centers = container.centers;

let idx = 0;
for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
            // Normalized position (0-1 range, will be denormalized in shader)
            const nx = x / (gridSize - 1);
            const ny = y / (gridSize - 1);
            const nz = z / (gridSize - 1);

            // World position for centers (for sorting)
            const px = (nx - 0.5) * posScale * 2;
            const py = (ny - 0.5) * posScale * 2;
            const pz = (nz - 0.5) * posScale * 2;

            // Brightness combines radial falloff (70%) + diagonal gradient (30%)
            const dx = nx - 0.5;
            const dy = ny - 0.5;
            const dz = nz - 0.5;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const maxDist = Math.sqrt(0.75);  // max distance in normalized cube
            const radial = 1.0 - (distFromCenter / maxDist) * 0.7;  // 0.3 to 1.0
            const diagonal = (nx + ny + nz) / 3.0;  // 0 to 1 corner-to-corner
            const brightness = radial * 0.7 + diagonal * 0.3;

            // Data: RGB = normalized position (0-255), A = brightness (0-255)
            data[idx * 4 + 0] = nx * 255;
            data[idx * 4 + 1] = ny * 255;
            data[idx * 4 + 2] = nz * 255;
            data[idx * 4 + 3] = brightness * 255;

            // Centers for sorting (xyz world position)
            centers[idx * 3 + 0] = px;
            centers[idx * 3 + 1] = py;
            centers[idx * 3 + 2] = pz;

            idx++;
        }
    }
}

container.getTexture('data').unlock();

// Set bounding box for culling
const halfSize = (gridSize / 2) * 0.5;
container.aabb = new pc.BoundingBox(pc.Vec3.ZERO, new pc.Vec3(halfSize, halfSize, halfSize));

// Create parent entity for the 2x2 grid
const parent = new pc.Entity('splatParent');
app.root.addChild(parent);

// Create 2x2x2 grid of splat entities, all sharing the same container
// Bounding sphere radius = halfSize * sqrt(3) for a cube; spacing = 2 * radius + margin
const boundingSphereRadius = halfSize * Math.sqrt(3);
const spacing = boundingSphereRadius * 2 + 1;

// Two vibrant contrasting tint colors per instance: [color A, color B]
const tintPairs = [
    [[1.0, 0.0, 0.2], [0.0, 1.0, 1.0]],  // hot pink ↔ cyan
    [[1.0, 1.0, 0.0], [1.0, 0.0, 1.0]],  // yellow ↔ magenta
    [[0.0, 1.0, 0.0], [1.0, 0.0, 0.0]],  // green ↔ red
    [[1.0, 0.5, 0.0], [0.0, 0.5, 1.0]],  // orange ↔ electric blue
    [[0.0, 0.0, 1.0], [1.0, 1.0, 0.0]],  // blue ↔ yellow
    [[1.0, 0.0, 0.5], [0.5, 1.0, 0.0]],  // magenta ↔ lime
    [[0.0, 1.0, 0.5], [1.0, 0.0, 1.0]],  // spring green ↔ purple
    [[1.0, 0.3, 0.0], [0.0, 1.0, 1.0]]   // bright orange ↔ aqua
];

/** @type {pc.Entity[]} */
const children = [];
let tintIndex = 0;
for (let gx = 0; gx < 2; gx++) {
    for (let gy = 0; gy < 2; gy++) {
        for (let gz = 0; gz < 2; gz++) {
            const child = new pc.Entity(`splat_${gx}_${gy}_${gz}`);
            child.addComponent('gsplat', {
                resource: container,
                unified: true
            });
            child.setLocalPosition(
                (gx - 0.5) * spacing,
                (gy - 0.5) * spacing,
                (gz - 0.5) * spacing
            );

            // Set per-instance tint gradient (center and edge colors)
            const [centerTint, edgeTint] = tintPairs[tintIndex++];
            child.gsplat?.setParameter('uTint', centerTint);
            child.gsplat?.setParameter('uTint2', edgeTint);

            parent.addChild(child);
            children.push(child);
        }
    }
}

// Create an Entity with a camera component
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    toneMapping: pc.TONEMAP_ACES
});
camera.setLocalPosition(0, 0, spacing * 3);
app.root.addChild(camera);

// Animate tints and rotate
let time = 0;
app.on('update', (dt) => {
    time += dt;

    // Rotate parent
    parent.setLocalEulerAngles(time * 15, time * 24, 0);

    // Rotate each child at different speeds
    children.forEach((child, i) => {
        const speed = 20 + i * 15;
        child.setLocalEulerAngles(time * speed, time * speed * 0.7, time * speed * 0.3);
    });

    // Animate tint colors - hue rotation for vivid saturated colors
    children.forEach((child, i) => {
        const phase = i * 0.8;  // different phase per instance
        const speed = 0.17;    // animation speed (slowed 3x)

        // Helper: convert hue (0-1) to RGB with full saturation
        const hueToRgb = (h) => {
            h = ((h % 1) + 1) % 1;  // normalize to 0-1
            const x = 1 - Math.abs((h * 6) % 2 - 1);
            if (h < 1 / 6) return [1, x, 0];
            if (h < 2 / 6) return [x, 1, 0];
            if (h < 3 / 6) return [0, 1, x];
            if (h < 4 / 6) return [0, x, 1];
            if (h < 5 / 6) return [x, 0, 1];
            return [1, 0, x];
        };

        // Primary and secondary tints: split-complementary (~90° apart)
        // Far enough for contrast, close enough to not cancel to grey
        const hue1 = time * speed + phase;
        const hue2 = hue1 + 0.25;  // ~90° offset

        child.gsplat?.setParameter('uTint', hueToRgb(hue1));
        child.gsplat?.setParameter('uTint2', hueToRgb(hue2));
    });

    // Bounce numSplats between 0 and max
    const t = (Math.cos(time * 0.5) + 1) * 0.5;
    container.numSplats = Math.floor(t * numSplats);
});

export { app };
