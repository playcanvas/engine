// @config
//
// Functional test of {accent:SceneDepthReader}. Three boxes stand at known distances from the camera,
// the depth of each is read back over a patch of samples centred on it, and a fourth patch is read from
// the empty space above them. The samples are compared against what the placement says they should be.
// The camera requests the scene depth itself, so what is read is the depth the grab pass produces - the
// non-linear encoding, which is the case a CPU side decode cannot handle at all.
//
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    PROJECTION_ORTHOGRAPHIC,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SceneDepthReader,
    Vec3,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, { deviceTypes: [deviceType], antialias: false });

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

app.start();

// ------ Three boxes, at 10, 15 and 20 units from the camera ------
const DISTANCES = [10, 15, 20];
const BOX_SIZE = 2;

DISTANCES.forEach((distance, i) => {
    const box = new Entity(`box-${i}`);
    box.addComponent('render', { type: 'box' });
    box.setLocalScale(BOX_SIZE, BOX_SIZE, BOX_SIZE);

    // spread across the view, with the front face at the distance being tested
    box.setLocalPosition((i - 1) * 3, 0, -distance - BOX_SIZE / 2);
    app.root.addChild(box);
});

const light = new Entity('light');
light.addComponent('light', { type: 'directional' });
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

const camera = new Entity('camera');
camera.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.15),
    nearClip: 0.1,
    farClip: 100,

    // orthographic, so a sample's depth is its distance along the view direction wherever the box sits
    // on screen, which makes the expected values exact
    projection: PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 6
});
app.root.addChild(camera);

// nothing else here consumes the depth, so it is requested outright - which is what puts the grab pass
// in the frame
camera.camera.requestSceneDepthMap(true);

// ------ Read the depth of each box, and of the empty space above them ------
const reader = new SceneDepthReader(camera.camera);

// how much of the view a box covers depends on the aspect ratio, so each region is derived from the
// projection rather than assumed - a small patch of samples centred on the box, well inside its edges
const SAMPLES = 4;
const PATCH = 0.02;
const boxRegions = DISTANCES.map(() => new Vec4());
const emptyRegion = new Vec4();
const worldPoint = new Vec3();
const screenPoint = new Vec3();

/**
 * Centres a normalized region on a world position.
 *
 * @param {Vec4} region - The region to place.
 * @param {number} x - The world x to centre it on.
 * @param {number} y - The world y to centre it on.
 * @param {number} z - The world z to centre it on.
 */
const placeRegion = (region, x, y, z) => {
    camera.camera.worldToScreen(worldPoint.set(x, y, z), screenPoint);
    const { width, height } = app.graphicsDevice.clientRect;

    // screen coordinates run down from the top, the regions up from the bottom
    region.set(screenPoint.x / width - PATCH / 2, 1 - screenPoint.y / height - PATCH / 2, PATCH, PATCH);
};

const report = document.createElement('pre');
report.style.cssText =
    'position:absolute;left:16px;bottom:16px;margin:0;padding:12px;background:rgba(0,0,0,0.7);' +
    'color:#fff;font:13px monospace;white-space:pre;pointer-events:none;';
document.body.appendChild(report);
app.on('destroy', () => {
    reader.destroy();
    report.remove();
});

/**
 * Compares the samples against the box placement.
 *
 * @param {Float32Array[]} results - A patch of samples per box, then the patch above them.
 * @returns {string} The result, one line per check.
 */
const check = (results) => {
    const lines = [];
    let passed = true;

    // the patch sits entirely on the box, so every sample in it is that box's distance
    DISTANCES.forEach((distance, i) => {
        const samples = Array.from(results[i]);
        const ok = samples.every((value) => Math.abs(value - distance) < 0.5);
        const range = `${Math.min(...samples).toFixed(2)} to ${Math.max(...samples).toFixed(2)}`;
        passed = passed && ok;
        lines.push(`box at ${distance}: samples ${range}  ${ok ? 'ok' : 'FAILED'}`);
    });

    // and nothing above them, so every sample there is infinite
    const allEmpty = Array.from(results[DISTANCES.length]).every((value) => value === Infinity);
    passed = passed && allEmpty;
    lines.push(`above the boxes: all infinite  ${allEmpty ? 'ok' : 'FAILED'}`);
    lines.push('', passed ? 'PASSED' : 'FAILED');

    return lines.join('\n');
};

let pending = false;
app.on('update', () => {
    if (pending) {
        return;
    }

    // one read per box, plus one clear of them - which also exercises several reads in flight at once
    DISTANCES.forEach((distance, i) => {
        placeRegion(boxRegions[i], (i - 1) * 3, 0, -distance - BOX_SIZE / 2);
    });
    placeRegion(emptyRegion, 0, 4.5, -15);

    const reads = boxRegions.map((region) => reader.read(region, SAMPLES, SAMPLES));
    reads.push(reader.read(emptyRegion, SAMPLES, SAMPLES));

    if (reads.some((read) => !read)) {
        report.textContent = 'waiting for the depth to be rendered';
        return;
    }

    pending = true;
    Promise.all(reads).then((results) => {
        report.textContent = check(results);
        pending = false;
    });
});
