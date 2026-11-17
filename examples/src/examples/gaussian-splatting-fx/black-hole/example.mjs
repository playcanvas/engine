// @config
//
// A black hole with a turbulent accretion disk of gaussian splats. The lensing is done by splatting
// too: each splat is drawn at the two or three places a curved ray of light shows it, from a table
// of Schwarzschild light bending, so the far side of the disk wraps over the shadow.
//
// `LMB` Orbit · `RMB` Pan · `Wheel` Zoom
//
// @flag WEBGL_DISABLED

import {
    AppBase,
    AutoExposureEffect,
    AppOptions,
    BoundingBox,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Entity,
    FILLMODE_FILL_WINDOW,
    FILTER_NEAREST,
    GSPLATDATA_LARGE,
    GSplatComponentSystem,
    GSplatContainer,
    GSplatFormat,
    PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RGBA8,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_ACES2,
    Texture,
    Vec2,
    Vec3,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

import readWGSL from './read.wgsl';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],

    // Gaussian splats do not benefit from antialiasing
    antialias: false
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    CameraComponentSystem,
    GSplatComponentSystem,
    RenderComponentSystem,
    ScriptComponentSystem
];

const app = new AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

// ---------------------------------------------------------------------------------------------
// Light bending around a Schwarzschild black hole, in units of its radius (rs = 1, c = 1).
//
// For a source at radius r, psi is the angle at the hole between the source and the camera, which
// a ray of light sweeps around the hole on its way to the camera. The table gives the impact
// parameter b of that ray, how far from the hole the camera sees the source, for every psi, and the
// cosine of the angle the ray leaves the source at, against the outward direction. A source has a
// primary image (psi in 0..pi), a secondary one on the far side of the hole (2 pi - psi), and a thin
// third one (2 pi + psi) next to the shadow, part of the photon ring.

const B_CRIT = 1.5 * Math.sqrt(3); // the edge of the shadow
const LENS_ROWS = 48;
const LENS_COLS = 1024;
const LENS_R_MIN = 2;
const LENS_R_MAX = 2000;
const LENS_PSI_MAX = 3 * Math.PI;

const buildLensTexture = () => {
    const steps = 160;

    // psi swept from u0 = 1 / r out to infinity by an outgoing ray, with u = u0 (1 - y^2) keeping
    // the integrand finite at a turning point
    const sweep = (b, u0) => {
        const ib2 = 1 / (b * b);
        let sum = 0;
        for (let i = 0; i < steps; i++) {
            const y = (i + 0.5) / steps;
            const u = u0 * (1 - y * y);
            sum += (2 * y * u0) / Math.sqrt(Math.max(ib2 - u * u + u * u * u, 1e-12));
        }
        return sum / steps;
    };

    // closest approach of a ray passing outside the photon sphere: smallest root of u^2 - u^3 = 1/b^2
    const periapsis = (b) => {
        const target = 1 / (b * b);
        let lo = 0,
            hi = 2 / 3;
        for (let i = 0; i < 50; i++) {
            const m = (lo + hi) * 0.5;
            if (m * m - m * m * m < target) lo = m;
            else hi = m;
        }
        return lo;
    };

    const pixels = new Float32Array(LENS_ROWS * LENS_COLS * 4);
    for (let row = 0; row < LENS_ROWS; row++) {
        const r = LENS_R_MIN * Math.pow(LENS_R_MAX / LENS_R_MIN, row / (LENS_ROWS - 1));
        const u0 = 1 / r;
        const tangential = r / Math.sqrt(1 - u0);

        // rays leaving outward (b from 0 to tangential), then rays leaving inward that pass a
        // periapsis first (b from tangential down to the shadow edge), so psi keeps increasing
        const path = [];
        const n = 400;
        for (let i = 0; i <= n; i++) {
            const b = tangential * Math.sin((i / n) * Math.PI * 0.5);
            const sinA = Math.min(1, (b * Math.sqrt(1 - u0)) / r);
            path.push([b === 0 ? 0 : sweep(b, u0), b, Math.sqrt(1 - sinA * sinA)]);
        }
        for (let i = 1; i <= n; i++) {
            const b = B_CRIT + (tangential - B_CRIT) * Math.pow(1 - i / n, 3) + 1e-6;
            const up = periapsis(b);
            if (up <= u0) continue;
            const sinA = Math.min(1, (b * Math.sqrt(1 - u0)) / r);
            path.push([2 * sweep(b, up) - sweep(b, u0), b, -Math.sqrt(1 - sinA * sinA)]);
        }

        let j = 0;
        for (let c = 0; c < LENS_COLS; c++) {
            const psi = (c / (LENS_COLS - 1)) * LENS_PSI_MAX;
            while (j < path.length - 2 && path[j + 1][0] < psi) j++;
            const [p0, b0, c0] = path[j];
            const [p1, b1, c1] = path[Math.min(j + 1, path.length - 1)];
            const t = p1 > p0 ? Math.min(Math.max((psi - p0) / (p1 - p0), 0), 1) : 1;
            const i4 = (row * LENS_COLS + c) * 4;
            pixels[i4] = b0 + (b1 - b0) * t;
            pixels[i4 + 1] = c0 + (c1 - c0) * t;
        }
    }

    const texture = new Texture(device, {
        name: 'LensTable',
        width: LENS_COLS,
        height: LENS_ROWS,
        format: PIXELFORMAT_RGBA32F,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        levels: [pixels]
    });
    return texture;
};

// ---------------------------------------------------------------------------------------------
// The splats. Each source - a clump of hot gas in the disk, or a star or a nebula far behind - is
// stored once per image it has, and the read shader (read.wgsl) moves it along its orbit and then
// to the place that image is seen at, stretched along the arc the lensing draws it into.

const KIND_DISK = 0;
const KIND_STAR = 1;
const KIND_NEBULA = 2;

const ISCO = 3; // innermost stable circular orbit, the inner edge of the disk

const format = new GSplatFormat(
    device,
    [
        { name: 'bhSource', format: PIXELFORMAT_RGBA32F }, // spawn radius, angle, height, kind
        { name: 'bhLook', format: PIXELFORMAT_RGBA32F }, // size, intensity, life phase, image
        { name: 'bhColor', format: PIXELFORMAT_RGBA8 } // tint
    ],
    { readWGSL }
);

/**
 * A small seeded random generator (mulberry32).
 *
 * @param {number} seed - The seed.
 * @returns {() => number} Function returning numbers in [0, 1).
 */
const createRandom = (seed) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * @param {number} scale - Splat count multiplier.
 * @returns {GSplatContainer} The container.
 */
const createScene = (scale) => {
    const rnd = createRandom(7);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-9))) * Math.cos(2 * Math.PI * rnd());

    const clumps = Math.round(12000 * scale);
    const clumpSize = 8;
    const smooth = Math.round(24000 * scale);
    const stars = Math.round(30000 * scale);
    const nebulae = 1600;

    // every source gets a primary and a secondary image, a third of them a photon ring image
    const sources = clumps * clumpSize + smooth + stars + nebulae;
    const total = sources * 2 + Math.ceil(sources / 3);

    const container = new GSplatContainer(device, total, format);
    const src = /** @type {Float32Array} */ (container.getTexture('bhSource').lock());
    const look = /** @type {Float32Array} */ (container.getTexture('bhLook').lock());
    const color = /** @type {Uint8Array} */ (container.getTexture('bhColor').lock());
    const centers = container.centers;

    let n = 0;
    let s = 0;
    const add = (r, angle, y, kind, size, intensity, phase, c) => {
        const images = s++ % 3 === 0 ? 3 : 2;
        for (let image = 0; image < images; image++) {
            const i = n * 4;
            src[i] = r;
            src[i + 1] = angle;
            src[i + 2] = y;
            src[i + 3] = kind;
            look[i] = size;
            look[i + 1] = intensity;
            look[i + 2] = phase;
            look[i + 3] = image;
            color[i] = c[0];
            color[i + 1] = c[1];
            color[i + 2] = c[2];
            color[i + 3] = 255;
            const h = kind === KIND_DISK ? y * r : y;
            centers[n * 3] = r * Math.cos(angle);
            centers[n * 3 + 1] = h;
            centers[n * 3 + 2] = r * Math.sin(angle);
            n++;
        }
    };

    // clumps of gas, which the faster inner orbits shear into streaks as they fall in
    for (let i = 0; i < clumps; i++) {
        const r0 = ISCO + 0.6 + Math.pow(rnd(), 1.4) * 18;
        const a0 = rnd() * Math.PI * 2;
        const phase = rnd();
        const spread = 0.15 + rnd() * 0.35;
        const bright = 0.6 + Math.pow(rnd(), 3) * 2;
        for (let k = 0; k < clumpSize; k++) {
            const r = Math.max(ISCO + 0.6, r0 + gauss() * spread);
            const c = [235 + rnd() * 20, 225 + rnd() * 30, 215 + rnd() * 40];
            add(
                r,
                a0 + (gauss() * spread) / r0,
                gauss() * 0.008,
                KIND_DISK,
                0.03 + 0.004 * r0 * (0.5 + rnd()),
                bright * (0.6 + rnd() * 0.6),
                phase,
                c
            );
        }
    }

    // a smoother layer of gas filling the disk
    for (let i = 0; i < smooth; i++) {
        const r0 = ISCO + 0.6 + Math.pow(rnd(), 1.2) * 20;
        add(
            r0,
            rnd() * Math.PI * 2,
            gauss() * 0.01,
            KIND_DISK,
            0.04 + 0.008 * r0 * (0.5 + rnd()),
            0.35 + rnd() * 0.3,
            rnd(),
            [255, 245, 235]
        );
    }

    // stars far behind, on a sphere
    const sphere = (dist) => {
        const u = rnd() * 2 - 1,
            phi = rnd() * Math.PI * 2;
        return [dist * Math.sqrt(1 - u * u), phi, dist * u];
    };
    for (let i = 0; i < stars; i++) {
        const [r, a, y] = sphere(1500 + rnd() * 400);
        const warm = rnd();
        const c = warm < 0.3 ? [255, 210, 170] : warm < 0.7 ? [255, 250, 245] : [190, 210, 255];
        add(r, a, y, KIND_STAR, 0.6 + rnd() * 0.8, Math.pow(rnd(), 6) * 6 + 0.3, 0, c);
    }

    // a band of colored nebulae across the sky behind, to show off the lensing
    for (let i = 0; i < nebulae; i++) {
        const along = rnd() * Math.PI * 2;
        const across = gauss() * 0.18;
        const dist = 1750;
        const x = Math.cos(along) * Math.cos(across),
            z = Math.sin(along) * Math.cos(across),
            yy = Math.sin(across);
        // the band is tilted against the disk
        const tilt = 0.5;
        const y = yy * Math.cos(tilt) - z * Math.sin(tilt);
        const zz = yy * Math.sin(tilt) + z * Math.cos(tilt);
        const hue = rnd();
        const c = hue < 0.4 ? [120, 90, 255] : hue < 0.75 ? [255, 90, 160] : [255, 170, 90];
        add(Math.hypot(x, zz) * dist, Math.atan2(zz, x), y * dist, KIND_NEBULA, 40 + rnd() * 90, 0.5 + rnd(), 0, c);
    }

    container.getTexture('bhSource').unlock();
    container.getTexture('bhLook').unlock();
    container.getTexture('bhColor').unlock();
    container.aabb = new BoundingBox(new Vec3(), new Vec3(2500, 2500, 2500));
    container.update(n);
    return container;
};

// ---------------------------------------------------------------------------------------------
// scene

const lensTexture = buildLensTexture();

const blackHole = new Entity('BlackHole');
blackHole.addComponent('gsplat', { resource: createScene(1) });
blackHole.gsplat.setParameter('bhLensTable', lensTexture);
blackHole.gsplat.setParameter('bhLensRange', [LENS_R_MIN, Math.log(LENS_R_MAX / LENS_R_MIN), LENS_PSI_MAX]);
blackHole.gsplat.setParameter('bhInnerRadius', ISCO);
app.root.addChild(blackHole);

app.scene.gsplat.dataFormat = GSPLATDATA_LARGE;
app.scene.gsplat.minPixelSize = 0;
app.scene.gsplat.minContribution = 0;
app.scene.gsplat.alphaClipForward = 1 / 1000;
app.scene.gsplat.antiAlias = true;

// The shadow: a black disc facing the camera, as wide as the shadow, at the hole. Splats seen in
// front of the hole draw over it, the ones behind it are hidden.
const shadowMaterial = new StandardMaterial();
shadowMaterial.diffuse = Color.BLACK;
shadowMaterial.useLighting = false;
shadowMaterial.useSkybox = false;
shadowMaterial.update();
const shadow = new Entity('Shadow');
shadow.addComponent('render', { type: 'sphere', material: shadowMaterial });
app.root.addChild(shadow);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0, 0, 0),
    fov: 40,
    nearClip: 0.1,
    farClip: 5000
});
const START = new Vec3(0, 5, 60);
camera.setLocalPosition(START);
camera.addComponent('script');
const cameraControls = /** @type {CameraControls} */ (
    camera.script.create(CameraControls, {
        properties: {
            focusPoint: new Vec3(0, 0, 0),
            zoomRange: new Vec2(8, 400),
            enableFly: false
        }
    })
);
app.root.addChild(camera);

const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_ACES2;
cameraFrame.bloom.blurLevel = 5;

// the disk is much brighter seen face on than edge on: auto exposure darkens the view as more of
// it fills the screen, and never brightens it above the set exposure
const autoExposure = new AutoExposureEffect(device);
autoExposure.minEv = -4;
autoExposure.maxEv = 0;
autoExposure.compensation = 1.5;
autoExposure.lowPercent = 0.5;
autoExposure.highPercent = 0.98;
cameraFrame.addEffect(autoExposure);
cameraFrame.update();

// ---------------------------------------------------------------------------------------------
// state

data.set('data', {
    play: true,
    speed: 12, // time units (the time light takes to cross the hole radius) per second
    inflow: 0.02,
    lensing: true,
    ring: 1,
    doppler: 0.8,
    temperature: 12000,
    brightness: 6,
    background: 0.6,
    diskOpacity: 0.5,
    falloff: 1.3,
    exposure: 1,
    bloom: 0.03
});

let time = 0;

const applyLook = () => {
    const gsplat = blackHole.gsplat;
    gsplat.setParameter('bhInflow', data.get('data.inflow'));
    gsplat.setParameter('bhLensing', data.get('data.lensing') ? 1 : 0);
    gsplat.setParameter('bhRing', data.get('data.ring'));
    gsplat.setParameter('bhDoppler', data.get('data.doppler'));
    gsplat.setParameter('bhTemperature', data.get('data.temperature'));
    gsplat.setParameter('bhBrightness', data.get('data.brightness'));
    gsplat.setParameter('bhBackground', data.get('data.background'));
    gsplat.setParameter('bhDiskOpacity', data.get('data.diskOpacity'));
    gsplat.setParameter('bhFalloff', data.get('data.falloff'));
    gsplat.setParameter('bhFocal', 0.5 / Math.tan((camera.camera.fov * Math.PI) / 360));
    app.scene.exposure = data.get('data.exposure');
    cameraFrame.bloom.intensity = data.get('data.bloom');
    cameraFrame.update();
};
applyLook();
data.on('*:set', applyLook);

data.on('view:side', () => cameraControls.reset(new Vec3(), START));
data.on('view:top', () => cameraControls.reset(new Vec3(), new Vec3(0, 45, 0.5)));
data.on('view:edge', () => cameraControls.reset(new Vec3(), new Vec3(0, 0.6, 40)));

const appliedCamera = new Vec3(Infinity, 0, 0);
const target = new Vec3();

app.on('update', (/** @type {number} */ dt) => {
    if (data.get('data.play')) {
        time += data.get('data.speed') * dt;
        blackHole.gsplat.setParameter('bhTime', time);
    }

    // the images depend on where the camera is, so the work buffer is rebuilt as it moves
    const position = camera.getPosition();
    if (position.distance(appliedCamera) > 1e-4) {
        appliedCamera.copy(position);
        blackHole.gsplat.setParameter('bhCameraPosition', [position.x, position.y, position.z]);
    }

    // the shadow faces the camera; flat, so the splats just in front of the hole are not inside it
    const radius = data.get('data.lensing') ? B_CRIT : 1;
    shadow.lookAt(target.copy(position));
    shadow.setLocalScale(radius * 2, radius * 2, 0.01);
});

export { app };
