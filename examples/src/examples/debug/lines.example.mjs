// @config
//
// The line drawing functions of WireRenderer. A dense animated wave field is submitted through
// the packed form, the ring markers are tied together with a closed loop and gradient spokes, and
// ten comets on separate paths each leave a fading trail.

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TouchDevice,
    Vec2,
    Vec3,
    WireRenderer,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType] });
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));
app.start();

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.015, 0.02, 0.03),
    farClip: 400
});
camera.addComponent('script');
camera.setLocalPosition(33, 41, 33);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 7, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-80, 80);
cameraControls.zoomRange = new Vec2(12, 140);

const wire = new WireRenderer(app);

// ----------------------------------------------------------------------------------------------
// The wave field, submitted with linesPacked. Every buffer is allocated once, which is the
// reason to prefer the packed form for geometry of this size.
// ----------------------------------------------------------------------------------------------

const GRID = 40;
const STEP = 1.5;
const ORIGIN = -((GRID - 1) * STEP) / 2;

// a grid of GRID x GRID vertices has this many edges
const SEGMENTS = 2 * GRID * (GRID - 1);
const gridPositions = new Float32Array(SEGMENTS * 6);
const gridColors = new Float32Array(SEGMENTS * 8);
const heights = new Float32Array(GRID * GRID);

// height ramp, from a deep trough color through the mid tone to a warm crest
const TROUGH = [0.03, 0.09, 0.28];
const MID = [0.08, 0.55, 0.66];
const CREST = [1.0, 0.84, 0.5];

/**
 * @param {number} x - The x coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} time - The elapsed time.
 * @returns {number} The surface elevation.
 */
const elevation = (x, z, time) => {
    const radius = Math.hypot(x, z);
    return (
        Math.sin(x * 0.22 + time) * 0.8 +
        Math.cos(z * 0.19 - time * 0.7) * 0.8 +
        (Math.sin(radius * 0.45 - time * 2.2) * 2.4) / (1 + radius * 0.14)
    );
};

/**
 * Writes one vertex of a segment into the packed buffers.
 *
 * @param {number} vertex - The vertex index to write.
 * @param {number} ix - The grid column.
 * @param {number} iz - The grid row.
 */
const writeVertex = (vertex, ix, iz) => {
    const height = heights[ix * GRID + iz];

    const p = vertex * 3;
    gridPositions[p] = ORIGIN + ix * STEP;
    gridPositions[p + 1] = height;
    gridPositions[p + 2] = ORIGIN + iz * STEP;

    // 0 at the deepest trough, 1 at the highest crest
    const t = Math.min(Math.max((height + 2.5) / 5.5, 0), 1);
    const lower = t < 0.5;
    const from = lower ? TROUGH : MID;
    const to = lower ? MID : CREST;
    const k = lower ? t * 2 : (t - 0.5) * 2;

    const c = vertex * 4;
    gridColors[c] = from[0] + (to[0] - from[0]) * k;
    gridColors[c + 1] = from[1] + (to[1] - from[1]) * k;
    gridColors[c + 2] = from[2] + (to[2] - from[2]) * k;
    gridColors[c + 3] = 1;
};

// ----------------------------------------------------------------------------------------------
// The orbiting markers, tied together with loop, lines and polyline
// ----------------------------------------------------------------------------------------------

const MARKERS = 6;
const ORBIT_RADIUS = 15;
const HUB = new Vec3(0, 17, 0);

/**
 * Where a marker sits at a given time. Used both to place the markers and to seed the trail with
 * the path the leading one has already travelled.
 *
 * @param {number} index - The marker index.
 * @param {number} t - The time to evaluate at.
 * @param {Vec3} out - The vector to write into.
 * @returns {Vec3} The supplied vector.
 */
const markerPosition = (index, t, out) => {
    const offset = (index * Math.PI * 2) / MARKERS;
    return out.set(
        Math.sin(t * 0.25 + offset) * ORBIT_RADIUS,
        10 + Math.sin(t * 1.2 + offset * 2) * 2.5,
        Math.cos(t * 0.25 + offset) * ORBIT_RADIUS
    );
};

/** @type {Entity[]} */
const markers = [];

// ring passed to loop(), spoke endpoints and colors passed to lines()
const ringPoints = [];
const spokePoints = [];
const spokeColors = [];

const MARKER_COLOR = new Color(0.55, 0.62, 0.75);

// emissive only, so the scene needs no lighting rig and the markers read against the wires
const markerMaterial = new StandardMaterial();
markerMaterial.diffuse = Color.BLACK;
markerMaterial.emissive = MARKER_COLOR;
markerMaterial.emissiveIntensity = 1.5;
markerMaterial.update();

for (let i = 0; i < MARKERS; i++) {
    const material = markerMaterial;

    const entity = new Entity(`marker${i}`);
    entity.addComponent('render', {
        type: i % 2 ? 'sphere' : 'box',
        material: material
    });
    entity.setLocalScale(0.85, 0.85, 0.85);
    app.root.addChild(entity);
    markers.push(entity);

    ringPoints.push(new Vec3());

    // each spoke runs from its marker to the hub, fading out as it goes
    spokePoints.push(new Vec3(), new Vec3());
    spokeColors.push(MARKER_COLOR.clone(), new Color(MARKER_COLOR.r, MARKER_COLOR.g, MARKER_COLOR.b, 0));
}

// A flock of comets weaving through the ring, each with a fading trail drawn by polyline. They
// follow their own paths rather than a ring marker's, whose trail would just retrace the ring.
// Samples are taken on a fixed time interval rather than once per frame, so a trail covers the
// same span of motion regardless of frame rate.
const COMETS = 10;
const TRAIL = 200;
const TRAIL_INTERVAL = 0.02;

/**
 * @typedef {object} Comet
 * @property {Entity} entity - The rendered marker.
 * @property {number} fx - Horizontal frequency.
 * @property {number} fy - Vertical frequency.
 * @property {number} fz - Depth frequency.
 * @property {number} ax - Horizontal amplitude.
 * @property {number} ay - Vertical amplitude.
 * @property {number} az - Depth amplitude.
 * @property {number} yc - Height the path is centered on.
 * @property {number} phase - Phase offset.
 * @property {Vec3[]} store - Ring buffer of past positions.
 * @property {Vec3[]} points - Ordered copy handed to polyline.
 * @property {Color[]} colors - Fixed alpha ramp along the trail.
 * @property {number} head - Next slot to write in the ring buffer.
 */

/**
 * Where a comet sits at a given time. Because this is analytic, a trail can be sampled at exact
 * past times rather than only at the positions that happened to be visited on a frame boundary.
 *
 * @param {Comet} comet - The comet to evaluate.
 * @param {number} t - The time to evaluate at.
 * @param {Vec3} out - The vector to write into.
 * @returns {Vec3} The supplied vector.
 */
const cometPosition = (comet, t, out) => {
    return out.set(
        Math.sin(t * comet.fx + comet.phase) * comet.ax,
        comet.yc + Math.sin(t * comet.fy + comet.phase * 1.7) * comet.ay,
        Math.cos(t * comet.fz + comet.phase) * comet.az
    );
};

/** @type {Comet[]} */
const comets = [];

for (let i = 0; i < COMETS; i++) {
    const hue = i / COMETS;
    const color = new Color(
        0.5 + 0.5 * Math.sin(hue * Math.PI * 2),
        0.5 + 0.5 * Math.sin(hue * Math.PI * 2 + 2.1),
        0.5 + 0.5 * Math.sin(hue * Math.PI * 2 + 4.2)
    );

    const material = new StandardMaterial();
    material.diffuse = Color.BLACK;
    material.emissive = color;
    material.emissiveIntensity = 4;
    material.update();

    const entity = new Entity(`comet${i}`);
    entity.addComponent('render', { type: 'sphere', material: material });
    entity.setLocalScale(1.1, 1.1, 1.1);
    app.root.addChild(entity);

    const store = [];
    const points = [];
    const colors = [];
    for (let t = 0; t < TRAIL; t++) {
        store.push(new Vec3());
        points.push(new Vec3());

        // the fade is squared so the head stays bright while the tail disappears. The ramp is
        // fixed, so it is set up once and never touched again.
        const k = t / (TRAIL - 1);
        colors.push(new Color(color.r, color.g, color.b, k * k));
    }

    // frequencies that do not divide evenly give each comet a path of its own, and the varied
    // amplitudes keep them on different shells rather than all crowding the same radius
    comets.push({
        entity: entity,
        fx: 0.34 + i * 0.058,
        fy: 0.7 + (i % 3) * 0.21,
        fz: 0.25 + ((i * 7) % 10) * 0.037,
        ax: 12 + (i % 4) * 4,
        ay: 2.8 + (i % 3) * 1.7,
        az: 12 + ((i + 2) % 4) * 4,
        yc: 6.5 + (i % 3) * 2.2,
        phase: i * 0.63,
        store: store,
        points: points,
        colors: colors,
        head: 0
    });
}

let trailSeeded = false;
let trailTimer = 0;

const RING_COLOR = new Color(0.95, 0.35, 0.9);
const MAST_COLOR = new Color(0.5, 0.55, 0.65);
const mastBase = new Vec3(0, -3.5, 0);
const scratch = new Vec3();

let time = 0;
app.on('update', (/** @type {number} */ dt) => {
    time += dt;

    // --- wave field, one packed submission ------------------------------------------------
    for (let ix = 0; ix < GRID; ix++) {
        const x = ORIGIN + ix * STEP;
        for (let iz = 0; iz < GRID; iz++) {
            heights[ix * GRID + iz] = elevation(x, ORIGIN + iz * STEP, time);
        }
    }

    let vertex = 0;
    for (let ix = 0; ix < GRID; ix++) {
        for (let iz = 0; iz < GRID; iz++) {
            if (ix > 0) {
                writeVertex(vertex++, ix - 1, iz);
                writeVertex(vertex++, ix, iz);
            }
            if (iz > 0) {
                writeVertex(vertex++, ix, iz - 1);
                writeVertex(vertex++, ix, iz);
            }
        }
    }
    wire.linesPacked(gridPositions, gridColors);

    // --- markers, and the shapes tying them together ---------------------------------------
    for (let i = 0; i < MARKERS; i++) {
        const entity = markers[i];
        entity.setLocalPosition(markerPosition(i, time, scratch));
        entity.rotate(18 * dt, 30 * dt, 42 * dt);

        const position = entity.getPosition();
        ringPoints[i].copy(position);
        spokePoints[i * 2].copy(position);
        spokePoints[i * 2 + 1].copy(HUB);
    }

    // the ring is genuinely closed, so loop() is a better fit than a line per pair
    wire.color = RING_COLOR;
    wire.loop(ringPoints);

    // spokes fade from each marker's own color to almost nothing at the hub
    wire.lines(spokePoints, spokeColors);

    // a single line for the mast the spokes converge on
    wire.color = MAST_COLOR;
    wire.line(mastBase, HUB);

    // --- the comets and their trails -------------------------------------------------------
    for (let i = 0; i < COMETS; i++) {
        const comet = comets[i];
        comet.entity.setLocalPosition(cometPosition(comet, time, scratch));
    }

    // seeding each buffer from the path already travelled means the trails are correct on the
    // very first frame, and keeps them permanently full so the arrays can be handed to polyline
    // as they are rather than sliced every frame
    if (!trailSeeded) {
        for (let i = 0; i < COMETS; i++) {
            const comet = comets[i];
            for (let t = 0; t < TRAIL; t++) {
                cometPosition(comet, time - (TRAIL - 1 - t) * TRAIL_INTERVAL, comet.store[t]);
            }
        }
        trailSeeded = true;
    }

    trailTimer += dt;
    let steps = Math.floor(trailTimer / TRAIL_INTERVAL);
    trailTimer -= steps * TRAIL_INTERVAL;

    // after a long stall there is no point replacing the buffer more than once over
    steps = Math.min(steps, TRAIL);

    for (let s = steps - 1; s >= 0; s--) {
        const sampleTime = time - trailTimer - s * TRAIL_INTERVAL;
        for (let i = 0; i < COMETS; i++) {
            const comet = comets[i];
            cometPosition(comet, sampleTime, comet.store[comet.head]);
            comet.head = (comet.head + 1) % TRAIL;
        }
    }

    for (let i = 0; i < COMETS; i++) {
        const comet = comets[i];

        // walk the ring buffer oldest first into the pre-allocated array handed to polyline
        for (let t = 0; t < TRAIL; t++) {
            comet.points[t].copy(comet.store[(comet.head + t) % TRAIL]);
        }
        wire.polyline(comet.points, comet.colors);
    }
});
