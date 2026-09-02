// @config
//
// Functional test of {accent:SceneDepthReader}. Three boxes stand at known distances from the camera,
// the depth of each is read back over a patch of samples centred on it, and a fourth patch is read from
// the empty space above them. The samples are compared against what the placement says they should be.
//
// Run once for each way the depth can be encoded, as the producers do not agree: the grab pass writes it
// non-linearly, the prepass writes it outright, and the scene pass accumulates an average of its
// reciprocal. Each is reached by configuring the camera rather than asked for directly, so the encoding
// which actually turned up is reported as well - a device which cannot render one falls back to another,
// and a silent fallback would otherwise read as a pass for a case which never ran.
//
// @flag HIDDEN

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    CameraFrame,
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

// A camera frame, left off until the phase which needs it. Depth of field is what makes the frame
// render a depth at all; which encoding that depth ends up in is decided by the rest of the settings.
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.dof.enabled = true;
cameraFrame.enabled = false;
cameraFrame.update();

/**
 * The encoding the depth currently assigned to the camera is in, named as the shader defines describe it.
 *
 * @returns {string} The encoding.
 */
const encoding = () => {
    const params = camera.camera.shaderParams;
    if (!params.sceneDepthMapLinear) {
        return 'non-linear';
    }
    if (params.sceneDepthMapReciprocal) {
        return 'reciprocal';
    }
    return params.sceneDepthMapPacked ? 'linear packed' : 'linear';
};

const PHASES = [
    {
        // nothing consumes the depth, so it is requested outright - which is what puts the grab pass in
        // the frame, and the grab pass keeps the depth buffer's own non-linear encoding
        name: 'depth grab',
        expect: 'non-linear',
        setup: () => {
            cameraFrame.enabled = false;
            cameraFrame.update();
            camera.camera.requestSceneDepthMap(true);
        }
    },
    {
        // the scene pass carries the depth as an additional attachment, which is the encoding the
        // blended gaussian splats can contribute to. Multi-sampling rules it out, so this is the phase
        // which leaves it off, and the splat setting is set because that is what the camera frame asks
        // for before it will spend the bandwidth on a half float attachment
        name: 'scene textures',
        expect: 'reciprocal',
        setup: () => {
            camera.camera.requestSceneDepthMap(false);
            app.scene.gsplat.sceneDepthWrite = true;
            cameraFrame.rendering.samples = 1;
            cameraFrame.enabled = true;
            cameraFrame.update();
        }
    },
    {
        // multi-sampling rules the scene textures out, which leaves the prepass to render the depth -
        // stored outright, either as a float or packed into RGBA8 where floats cannot be rendered to
        name: 'depth prepass',
        expect: 'linear',
        setup: () => {
            camera.camera.requestSceneDepthMap(false);
            cameraFrame.rendering.samples = 4;
            cameraFrame.enabled = true;
            cameraFrame.update();
        }
    }
];

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
 * @param {{ name: string, expect: string }} phase - The phase the samples were read in.
 * @returns {{ text: string, passed: boolean }} The result, one line per check, and whether all held.
 */
const check = (results, phase) => {
    const lines = [];
    const found = encoding();
    let passed = found === phase.expect;

    lines.push(`${phase.name}: ${found}${passed ? '' : ` - expected ${phase.expect}, FALLBACK`}`);

    // the patch sits entirely on the box, so every sample in it is that box's distance
    DISTANCES.forEach((distance, i) => {
        const samples = Array.from(results[i]);
        const ok = samples.every((value) => Math.abs(value - distance) < 0.5);
        const range = `${Math.min(...samples).toFixed(2)} to ${Math.max(...samples).toFixed(2)}`;
        passed = passed && ok;
        lines.push(`  box at ${distance}: samples ${range}  ${ok ? 'ok' : 'FAILED'}`);
    });

    // and nothing above them, so every sample there is infinite
    const allEmpty = Array.from(results[DISTANCES.length]).every((value) => value === Infinity);
    passed = passed && allEmpty;
    lines.push(`  above the boxes: all infinite  ${allEmpty ? 'ok' : 'FAILED'}`);

    return { text: lines.join('\n'), passed };
};

// A phase is set up, given a frame for the passes to be rebuilt and the depth to be rendered, and then
// read. Reads return null until there is a depth to read, which is the other half of the waiting.
const SETTLE_FRAMES = 2;
const reports = [];
let phaseIndex = 0;
let framesInPhase = 0;
let pending = false;
let allPassed = true;

app.on('update', () => {
    if (pending || phaseIndex >= PHASES.length) {
        return;
    }

    const phase = PHASES[phaseIndex];
    if (framesInPhase === 0) {
        phase.setup();
    }
    if (++framesInPhase <= SETTLE_FRAMES) {
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
        report.textContent = [...reports, `${phase.name}: waiting for the depth`].join('\n');
        return;
    }

    pending = true;
    Promise.all(reads).then((results) => {
        const { text, passed } = check(results, phase);
        reports.push(text);
        allPassed = allPassed && passed;

        phaseIndex++;
        framesInPhase = 0;
        pending = false;

        const done = phaseIndex >= PHASES.length;
        report.textContent = [...reports, '', done ? (allPassed ? 'PASSED' : 'FAILED') : ''].join('\n');
    });
});
