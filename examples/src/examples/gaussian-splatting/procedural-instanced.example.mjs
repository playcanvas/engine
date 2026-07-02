// @config
//
// A static GSplatContainer with custom data format, rendered as multiple instances. Per-instance color
// tints are animated via shader uniforms using setParameter.

import * as pc from 'playcanvas';

import { data, deviceType } from 'examples/context';

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

// set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

data.on('renderer:set', () => {
    app.scene.gsplat.renderer = data.get('renderer');
    const current = app.scene.gsplat.currentRenderer;
    if (current !== data.get('renderer')) {
        setTimeout(() => data.set('renderer', current), 0);
    }
});
data.set('renderer', pc.GSPLAT_RENDERER_AUTO);

// grid bounds for position denormalization
const gridSize = 10;
const posScale = (gridSize / 2) * 0.5; // positions range from -posscale to +posscale

// create custom format with single rgba8 texture (rgb=normalized position, a=brightness)
// and custom utint/utint2 uniforms for per-instance color gradient
const format = new pc.GSplatFormat(
    device,
    [
        // this line gives us 'loaddata' function in the shader, returning vec4
        { name: 'data', format: pc.PIXELFORMAT_RGBA8 }
    ],
    {
        readGLSL: `
        uniform vec3 uTint;
        uniform vec3 uTint2;

        vec3 getCenter() {
            vec4 splatData = loadData();
            return (splatData.rgb - 0.5) * ${(posScale * 2.0).toFixed(1)};
        }

        vec4 getColor() {
            vec4 splatData = loadData();
            vec3 tint = mix(uTint2, uTint, splatData.a);
            return vec4(tint, 1.0);
        }

        vec3 getScale() { return vec3(0.15); }
        vec4 getRotation() { return vec4(0.0, 0.0, 0.0, 1.0); }
    `,
        readWGSL: `
        uniform uTint: vec3f;
        uniform uTint2: vec3f;

        fn getCenter() -> vec3f {
            let splatData = loadData();
            return (splatData.rgb - 0.5) * ${(posScale * 2.0).toFixed(1)};
        }

        fn getColor() -> vec4f {
            let splatData = loadData();
            let tint = mix(uniform.uTint2, uniform.uTint, splatData.a);
            return vec4f(tint, 1.0);
        }

        fn getScale() -> vec3f { return vec3f(0.15); }
        fn getRotation() -> vec4f { return vec4f(0.0, 0.0, 0.0, 1.0); }
    `
    }
);

// create container with max capacity
const maxSplats = gridSize ** 3;
const container = new pc.GSplatContainer(device, maxSplats, format);

// fill data texture (rgba8: rgb=normalized position 0-1, a=brightness 0-1)
const textureData = container.getTexture('data').lock();
// fill centers array for sorting (float32array with xyz per splat)
const centers = container.centers;

let idx = 0;
for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
            // normalized position (0-1 range, will be denormalized in shader)
            const nx = x / (gridSize - 1);
            const ny = y / (gridSize - 1);
            const nz = z / (gridSize - 1);

            // world position for centers (for sorting)
            const px = (nx - 0.5) * posScale * 2;
            const py = (ny - 0.5) * posScale * 2;
            const pz = (nz - 0.5) * posScale * 2;

            // brightness combines radial falloff (70%) + diagonal gradient (30%)
            const dx = nx - 0.5;
            const dy = ny - 0.5;
            const dz = nz - 0.5;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const maxDist = Math.sqrt(0.75); // max distance in normalized cube
            const radial = 1.0 - (distFromCenter / maxDist) * 0.7; // 0.3 to 1.0
            const diagonal = (nx + ny + nz) / 3.0; // 0 to 1 corner-to-corner
            const brightness = radial * 0.7 + diagonal * 0.3;

            // data: rgb = normalized position (0-255), a = brightness (0-255)
            textureData[idx * 4 + 0] = nx * 255;
            textureData[idx * 4 + 1] = ny * 255;
            textureData[idx * 4 + 2] = nz * 255;
            textureData[idx * 4 + 3] = brightness * 255;

            // centers for sorting (xyz world position)
            centers[idx * 3 + 0] = px;
            centers[idx * 3 + 1] = py;
            centers[idx * 3 + 2] = pz;

            idx++;
        }
    }
}

container.getTexture('data').unlock();

// set bounding box for culling
const halfSize = (gridSize / 2) * 0.5;
container.aabb = new pc.BoundingBox(pc.Vec3.ZERO, new pc.Vec3(halfSize, halfSize, halfSize));

// create parent entity for the 2x2 grid
const parent = new pc.Entity('splatParent');
app.root.addChild(parent);

// create 2x2x2 grid of splat entities, all sharing the same container
// bounding sphere radius = halfsize * sqrt(3) for a cube; spacing = 2 * radius + margin
const boundingSphereRadius = halfSize * Math.sqrt(3);
const spacing = boundingSphereRadius * 2 + 1;

// two vibrant contrasting tint colors per instance: [color a, color b]
const tintPairs = [
    [
        [1.0, 0.0, 0.2],
        [0.0, 1.0, 1.0]
    ], // hot pink ↔ cyan
    [
        [1.0, 1.0, 0.0],
        [1.0, 0.0, 1.0]
    ], // yellow ↔ magenta
    [
        [0.0, 1.0, 0.0],
        [1.0, 0.0, 0.0]
    ], // green ↔ red
    [
        [1.0, 0.5, 0.0],
        [0.0, 0.5, 1.0]
    ], // orange ↔ electric blue
    [
        [0.0, 0.0, 1.0],
        [1.0, 1.0, 0.0]
    ], // blue ↔ yellow
    [
        [1.0, 0.0, 0.5],
        [0.5, 1.0, 0.0]
    ], // magenta ↔ lime
    [
        [0.0, 1.0, 0.5],
        [1.0, 0.0, 1.0]
    ], // spring green ↔ purple
    [
        [1.0, 0.3, 0.0],
        [0.0, 1.0, 1.0]
    ] // bright orange ↔ aqua
];

/** @type {pc.Entity[]} */
const children = [];
let tintIndex = 0;
for (let gx = 0; gx < 2; gx++) {
    for (let gy = 0; gy < 2; gy++) {
        for (let gz = 0; gz < 2; gz++) {
            const child = new pc.Entity(`splat_${gx}_${gy}_${gz}`);
            child.addComponent('gsplat', {
                resource: container
            });
            child.setLocalPosition((gx - 0.5) * spacing, (gy - 0.5) * spacing, (gz - 0.5) * spacing);

            // set per-instance tint gradient (center and edge colors)
            const [centerTint, edgeTint] = tintPairs[tintIndex++];
            child.gsplat?.setParameter('uTint', centerTint);
            child.gsplat?.setParameter('uTint2', edgeTint);

            parent.addChild(child);
            children.push(child);
        }
    }
}

// create an entity with a camera component
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
    toneMapping: pc.TONEMAP_ACES
});
camera.setLocalPosition(0, 0, spacing * 3);
app.root.addChild(camera);

// animate tints and rotate
let time = 0;
app.on('update', (dt) => {
    time += dt;

    // rotate parent
    parent.setLocalEulerAngles(time * 15, time * 24, 0);

    // rotate each child at different speeds
    children.forEach((child, i) => {
        const speed = 20 + i * 15;
        child.setLocalEulerAngles(time * speed, time * speed * 0.7, time * speed * 0.3);
    });

    // animate tint colors - hue rotation for vivid saturated colors
    children.forEach((child, i) => {
        const phase = i * 0.8; // different phase per instance
        const speed = 0.17; // animation speed (slowed 3x)

        // helper: convert hue (0-1) to rgb with full saturation
        const hueToRgb = (h) => {
            h = ((h % 1) + 1) % 1; // normalize to 0-1
            const x = 1 - Math.abs(((h * 6) % 2) - 1);
            if (h < 1 / 6) return [1, x, 0];
            if (h < 2 / 6) return [x, 1, 0];
            if (h < 3 / 6) return [0, 1, x];
            if (h < 4 / 6) return [0, x, 1];
            if (h < 5 / 6) return [x, 0, 1];
            return [1, 0, x];
        };

        // primary and secondary tints: split-complementary (~90° apart)
        // far enough for contrast, close enough to not cancel to grey
        const hue1 = time * speed + phase;
        const hue2 = hue1 + 0.25; // ~90° offset

        child.gsplat?.setParameter('uTint', hueToRgb(hue1));
        child.gsplat?.setParameter('uTint2', hueToRgb(hue2));
    });

    // bounce numsplats between 0 and max
    const t = (Math.cos(time * 0.5) + 1) * 0.5;
    // use update() with centersupdated=false since centers are static (pre-filled)
    container.update(Math.floor(t * maxSplats), false);
});
