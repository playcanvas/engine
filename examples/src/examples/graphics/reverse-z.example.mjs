// @config DESCRIPTION Reverse-Z depth buffering (Only on WebGPU). Maps the camera near plane to depth=1 and far to depth=0, dramatically improving floating-point precision over large view distances. Camera uses near=0.1 / far=1,000,000. Switch the device type to WebGL2 to see the same scene without reverse-z (distant coplanar pairs z-fight) — WebGL2 lacks reverse-z support so it acts as the "feature off" comparison.
import { deviceType } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    // opt in to reverse-z when running on WebGPU; ignored on WebGL2
    reverseZ: true
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

app.start();

// camera with extreme near/far
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.05, 0.05, 0.08),
    fov: 60,
    nearClip: 0.1,
    farClip: 1000000,
    toneMapping: pc.TONEMAP_LINEAR
});
app.root.addChild(camera);

// test pattern: at increasing depths along -Z, place a pair of overlapping quads.
// blue back quad (full size), red front quad (smaller, centered, sits a tiny epsilon in front).
// Correct sort: blue frame surrounds red center at every distance.
// With z-fighting (forward-z without enough precision at large distance), the boundary
// shimmers and the red quad is overwritten by blue at the far pairs.
// Distances span 5 orders of magnitude — far pairs would z-fight in forward-z.
const distances = [10, 100, 1_000, 10_000, 100_000];
const epsilonFactor = 1e-5; // tiny relative offset, hardware-z difference vanishes at distance

// build a unit plane geometry once
const planeMesh = pc.Mesh.fromGeometry(device, new pc.PlaneGeometry({ halfExtents: new pc.Vec2(0.5, 0.5) }));

/**
 * @param {pc.Color} color - Emissive color.
 * @param {pc.Vec3} pos - World position.
 * @param {number} screenScale - Plane size at distance.
 * @returns {pc.Entity} The created entity.
 */
const makeQuadEntity = (color, pos, screenScale) => {
    // unlit-style material via emissive (StandardMaterial diffuse needs lights/IBL to show)
    const m = new pc.StandardMaterial();
    m.diffuse = pc.Color.BLACK;
    m.emissive = color;
    m.emissiveIntensity = 1;
    m.useLighting = false;
    m.cull = pc.CULLFACE_NONE;
    m.update();

    const e = new pc.Entity();
    e.addComponent('render', {
        meshInstances: [new pc.MeshInstance(planeMesh, m)]
    });

    e.setLocalScale(screenScale, screenScale, screenScale);
    // orient face towards camera (PlaneGeometry is XZ with normal +Y, so rotate -90 around X
    // to put the normal along +Z — towards a camera that looks down -Z)
    e.setEulerAngles(-90, 0, 0);
    e.setPosition(pos);
    return e;
};

// arrange pairs in a horizontal row so all 5 distances are simultaneously visible.
// each pair sits at a different angular offset from the camera forward axis so they
// don't occlude each other in screen space. Per-pair size scales with distance so all
// pairs appear roughly the same size on screen.
const angleStepDeg = 12;
const angleStartDeg = -((distances.length - 1) * angleStepDeg) / 2;
const screenScaleFactor = 0.18; // controls on-screen size of each pair

distances.forEach((d, i) => {
    const eps = d * epsilonFactor;
    const angleRad = (angleStartDeg + i * angleStepDeg) * pc.math.DEG_TO_RAD;
    const cx = Math.sin(angleRad) * d;
    const cz = -Math.cos(angleRad) * d;

    const baseSize = d * screenScaleFactor;

    // back quad (blue) — full size
    const back = makeQuadEntity(new pc.Color(0.1, 0.3, 0.9), new pc.Vec3(cx, 0, cz - eps), baseSize);
    app.root.addChild(back);

    // front quad (red) — 70% size, blue frame visible around it at every distance
    const front = makeQuadEntity(new pc.Color(0.95, 0.2, 0.2), new pc.Vec3(cx, 0, cz + eps), baseSize * 0.7);
    app.root.addChild(front);
});

// camera fixed, slow orbit so we can see depth parallax
app.on('update', () => {
    const t = performance.now() * 0.0003;
    camera.setPosition(Math.sin(t) * 2, Math.cos(t * 0.7) * 1.5, 0);
    camera.lookAt(0, 0, -100);
});

export { app };
