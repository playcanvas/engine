// @config
//
// Measures the GPU cost of the flat per-splat varyings (gaussianColor, id, vLinearDepth) in the
// gsplat shaders, see https://github.com/playcanvas/engine/issues/10085. Renders a synthetic
// splat scene with the stock shaders and with the flat qualifiers removed, alternating the
// variants, and reports the median GPU frame time of each. Temporary test, not to be merged.
//
// @flag NO_MINISTATS
// @flag NO_DEVICE_SELECTOR
// @flag WEBGPU_DISABLED
// @flag WEBGL_DISABLED

import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_NONE,
    GSPLAT_RENDERER_RASTER_CPU_SORT,
    GSPLAT_RENDERER_RASTER_GPU_SORT,
    GSplatComponentSystem,
    GSplatData,
    GSplatResource,
    RESOLUTION_FIXED,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    ShaderChunks,
    WebglGraphicsDevice,
    WebgpuGraphicsDevice,
    platform,
    version,
    revision
} from 'playcanvas';

/**
 * @import { GraphicsDevice } from 'playcanvas'
 */

// ── Test parameters ──

// Mobile devices use a lighter profile (fewer splats, lower resolution, fewer frames) so the test
// stays short and does not overheat them. Larger splats keep the test fill-rate bound, where the
// varyings matter.
const PROFILE = platform.mobile
    ? { name: 'mobile', splats: 250000, scale: 2, width: 960, height: 600, warmup: 30, measure: 60 }
    : { name: 'desktop', splats: 500000, scale: 2, width: 1600, height: 1000, warmup: 40, measure: 100 };
const NUM_SPLATS = PROFILE.splats;
const SPLAT_SCALE = PROFILE.scale;
const WIDTH = PROFILE.width;
const HEIGHT = PROFILE.height;
const WARMUP_FRAMES = PROFILE.warmup;
const MEASURE_FRAMES = PROFILE.measure;
const REPEATS = 3;

/**
 * Shader variants. `patch` rewrites the gsplat chunks of a device before any shader compiles.
 *
 * @type {{ key: string, label: string, devices: string[], patch: (code: string) => string }[]}
 */
const VARIANTS = [
    {
        key: 'flat',
        label: 'flat (stock)',
        devices: ['webgpu', 'webgl2'],
        patch: (code) => code
    },
    {
        key: 'noflat',
        label: 'flat removed',
        devices: ['webgpu', 'webgl2'],
        patch: (code) =>
            code
                .replace(/@interpolate\(flat, either\) (gaussianColor|id|vLinearDepth):/g, '$1:')
                .replace(/flat varying (mediump vec4 gaussianColor|float id|float vLinearDepth);/g, 'varying $1;')
    },
    {
        key: 'flatfirst',
        label: 'flat, first',
        devices: ['webgpu'],
        patch: (code) =>
            code.replace(
                /@interpolate\(flat, either\) (gaussianColor|id|vLinearDepth):/g,
                '@interpolate(flat, first) $1:'
            )
    }
];

// ── UI ──

const appCanvas = document.getElementById('application-canvas');
if (appCanvas) appCanvas.remove();

const panel = document.createElement('div');
Object.assign(panel.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '100',
    overflow: 'auto',
    color: '#eee',
    background: '#111',
    font: '13px monospace',
    padding: '16px',
    boxSizing: 'border-box',
    whiteSpace: 'pre-wrap'
});
document.body.appendChild(panel);

const titleEl = document.createElement('div');
titleEl.style.fontSize = '18px';
titleEl.style.marginBottom = '8px';
titleEl.textContent = 'GSplat flat varyings test (engine issue #10085)';
panel.appendChild(titleEl);

const statusEl = document.createElement('div');
statusEl.style.color = '#fc6';
statusEl.style.marginBottom = '8px';
panel.appendChild(statusEl);

const buttonsEl = document.createElement('div');
buttonsEl.style.marginBottom = '12px';
panel.appendChild(buttonsEl);

/**
 * @param {string} text - Button label.
 * @param {() => void} onClick - Click handler.
 * @returns {HTMLButtonElement} The button.
 */
const makeButton = (text, onClick) => {
    const b = document.createElement('button');
    b.textContent = text;
    Object.assign(b.style, { font: '14px monospace', padding: '6px 14px', marginRight: '8px', cursor: 'pointer' });
    b.addEventListener('click', onClick);
    buttonsEl.appendChild(b);
    return b;
};

const reportEl = document.createElement('div');
panel.appendChild(reportEl);

/** @param {string} s - Status text. */
const setStatus = (s) => {
    statusEl.textContent = s;
};

// ── Synthetic scene ──

/**
 * Deterministic synthetic splats, regenerated per run as the resource may modify its data.
 *
 * @returns {GSplatData} The splat data.
 */
const createSplatData = () => {
    let seed = 12345;
    const rnd = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const names = [
        'x',
        'y',
        'z',
        'scale_0',
        'scale_1',
        'scale_2',
        'rot_0',
        'rot_1',
        'rot_2',
        'rot_3',
        'f_dc_0',
        'f_dc_1',
        'f_dc_2',
        'opacity'
    ];
    /** @type {Record<string, Float32Array>} */
    const p = {};
    names.forEach((n) => {
        p[n] = new Float32Array(NUM_SPLATS);
    });
    const scale = () => Math.log(SPLAT_SCALE * (0.01 + rnd() * 0.04));
    for (let i = 0; i < NUM_SPLATS; i++) {
        p.x[i] = (rnd() - 0.5) * 4;
        p.y[i] = (rnd() - 0.5) * 2.5;
        p.z[i] = (rnd() - 0.5) * 4;
        p.scale_0[i] = scale();
        p.scale_1[i] = scale();
        p.scale_2[i] = scale();
        const a = rnd() * Math.PI * 2;
        const b = rnd() * Math.PI * 2;
        p.rot_0[i] = Math.cos(a);
        p.rot_1[i] = Math.sin(a) * Math.cos(b);
        p.rot_2[i] = Math.sin(a) * Math.sin(b);
        p.rot_3[i] = 0;
        p.f_dc_0[i] = rnd() * 2 - 1;
        p.f_dc_1[i] = rnd() * 2 - 1;
        p.f_dc_2[i] = rnd() * 2 - 1;
        p.opacity[i] = rnd() * 4 - 2;
    }
    return new GSplatData([
        {
            name: 'vertex',
            count: NUM_SPLATS,
            properties: names.map((name) => ({ type: 'float', name, storage: p[name], byteSize: 4 }))
        }
    ]);
};

// ── Device helpers ──

/**
 * @param {HTMLCanvasElement} canvas - The canvas.
 * @param {string} deviceType - 'webgpu' or 'webgl2'.
 * @returns {Promise<GraphicsDevice>} The device.
 */
const createDevice = async (canvas, deviceType) => {
    const opts = { antialias: false };
    if (deviceType === 'webgpu') {
        const device = new WebgpuGraphicsDevice(canvas, opts);
        await device.initWebGpu('./assets/wasm/glslang/glslang.js', './assets/wasm/twgsl/twgsl.js');
        return device;
    }
    return new WebglGraphicsDevice(canvas, opts);
};

/**
 * @param {GraphicsDevice} device - The device.
 * @returns {string} GPU description.
 */
const getGpuInfo = (device) => {
    const dev = /** @type {any} */ (device);
    if (device.isWebGPU) {
        const info = dev.gpuAdapter?.info;
        if (!info) return 'unknown';
        return [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' / ');
    }
    return `${dev.unmaskedRenderer || '?'} (${dev.unmaskedVendor || '?'})`;
};

/**
 * Applies the variant's patch to all gsplat chunks of the device.
 *
 * @param {GraphicsDevice} device - The device.
 * @param {(code: string) => string} patch - The patch.
 * @returns {number} Number of chunks changed.
 */
const patchChunks = (device, patch) => {
    let changed = 0;
    for (const lang of [SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL]) {
        const map = ShaderChunks.get(device, lang);
        for (const [name, code] of [...map]) {
            if (!name.toLowerCase().includes('gsplat')) continue;
            const patched = patch(code);
            if (patched !== code) {
                map.set(name, patched);
                changed++;
            }
        }
    }
    return changed;
};

/**
 * @param {number[]} values - Values.
 * @returns {number} Median.
 */
const median = (values) => {
    const s = [...values].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ── One measured run ──

/**
 * @param {string} deviceType - 'webgpu' or 'webgl2'.
 * @param {(typeof VARIANTS)[number]} variant - The shader variant.
 * @param {string} label - Progress label.
 * @returns {Promise<{ ms: number, gpuTiming: boolean, gpuInfo: string, chunks: number } | null>} Result, null if the device is unavailable.
 */
const runOnce = async (deviceType, variant, label) => {
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        zIndex: '50'
    });
    document.body.appendChild(canvas);
    panel.style.background = 'rgba(17,17,17,0.6)';

    /** @type {GraphicsDevice} */
    let device;
    try {
        device = await createDevice(canvas, deviceType);
    } catch (_e) {
        canvas.remove();
        return null;
    }
    if (deviceType === 'webgpu' && !device.isWebGPU) {
        device.destroy();
        canvas.remove();
        return null;
    }

    const gpuInfo = getGpuInfo(device);
    const gpuTiming =
        deviceType === 'webgpu' ? !!device.gpuProfiler : !!(/** @type {any} */ (device).extDisjointTimerQuery);

    const createOptions = new AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.componentSystems = [CameraComponentSystem, GSplatComponentSystem];

    const app = new AppBase(canvas);
    app.init(createOptions);

    // the gsplat chunks are registered by the component system, so patch after init
    const chunks = patchChunks(device, variant.patch);

    app.setCanvasFillMode(FILLMODE_NONE);
    app.setCanvasResolution(RESOLUTION_FIXED, WIDTH, HEIGHT);
    app.scene.gsplat.renderer = device.isWebGPU ? GSPLAT_RENDERER_RASTER_GPU_SORT : GSPLAT_RENDERER_RASTER_CPU_SORT;
    if (gpuTiming) device.gpuProfiler.enabled = true;

    const splats = new Entity('splats');
    splats.addComponent('gsplat', { resource: new GSplatResource(device, createSplatData()), unified: true });
    app.root.addChild(splats);

    const camera = new Entity('camera');
    camera.addComponent('camera', { clearColor: new Color(0, 0, 0), fov: 60 });
    camera.setPosition(0, 0, 4.2);
    app.root.addChild(camera);

    app.start();

    const ms = await new Promise((resolve) => {
        /** @type {number[]} */
        const times = [];
        let frame = 0;
        let last = 0;
        const onFrameEnd = () => {
            frame++;
            const now = performance.now();
            if (frame > WARMUP_FRAMES) {
                if (gpuTiming) {
                    const t = device.gpuProfiler.frameTime;
                    if (t > 0) times.push(t);
                } else if (last) {
                    times.push(now - last);
                }
            }
            last = now;
            setStatus(
                `${label}  ${frame <= WARMUP_FRAMES ? `warming up ${frame}/${WARMUP_FRAMES}` : `measuring ${times.length}/${MEASURE_FRAMES}`}`
            );
            if (times.length >= MEASURE_FRAMES) {
                app.off('frameend', onFrameEnd);
                resolve(median(times));
            }
        };
        app.on('frameend', onFrameEnd);
    });

    app.destroy();
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
    panel.style.background = '#111';

    // give the GPU a moment to release the previous device
    await new Promise((resolve) => {
        setTimeout(resolve, 500);
    });

    return { ms, gpuTiming, gpuInfo, chunks };
};

// ── Test sequence and report ──

let running = false;
let lastReport = '';
/** @type {{ run: HTMLButtonElement | null, copy: HTMLButtonElement | null }} */
const buttons = { run: null, copy: null };

const runTest = async () => {
    if (running) return;
    running = true;
    buttons.run.disabled = true;
    buttons.copy.disabled = true;
    reportEl.textContent = '';

    const started = new Date();
    const lines = [];
    const conclusions = [];

    for (const deviceType of ['webgpu', 'webgl2']) {
        const variants = VARIANTS.filter((v) => v.devices.includes(deviceType));
        /** @type {Record<string, number[]>} */
        const results = {};
        variants.forEach((v) => {
            results[v.key] = [];
        });
        let gpuInfo = '';
        let gpuTiming = true;
        let available = true;
        const total = REPEATS * variants.length;
        let step = 0;

        for (let r = 0; r < REPEATS && available; r++) {
            for (const v of variants) {
                step++;
                // runs must be sequential, each owns the GPU
                // eslint-disable-next-line no-await-in-loop
                const res = await runOnce(deviceType, v, `${deviceType} ${step}/${total}: ${v.label}`);
                if (!res) {
                    available = false;
                    break;
                }
                gpuInfo = res.gpuInfo;
                gpuTiming = res.gpuTiming;
                results[v.key].push(res.ms);
                if (v.key === 'noflat' && res.chunks === 0) {
                    lines.push(`WARNING: ${deviceType} - no chunks were patched for '${v.label}'`);
                }
            }
        }

        lines.push('');
        if (!available) {
            lines.push(`${deviceType.toUpperCase()}: not available`);
            continue;
        }
        lines.push(`${deviceType.toUpperCase()}  GPU: ${gpuInfo}`);
        lines.push(
            `  timing: ${gpuTiming ? 'GPU timer queries' : 'wall clock (no GPU timers - may be vsync limited)'}`
        );
        const base = median(results.flat);
        for (const v of variants) {
            const m = median(results[v.key]);
            const delta =
                v.key === 'flat' ? '' : `  ${m >= base ? '+' : ''}${((m / base - 1) * 100).toFixed(1)}% vs stock`;
            const runs = results[v.key].map((t) => t.toFixed(2)).join(', ');
            lines.push(`  ${v.label.padEnd(14)} ${m.toFixed(2).padStart(8)} ms${delta.padEnd(20)}  runs: ${runs}`);
        }
        const noflat = median(results.noflat);
        const pct = (base / noflat - 1) * 100;
        conclusions.push(
            `${deviceType}: stock flat is ${Math.abs(pct).toFixed(1)}% ${pct > 0 ? 'SLOWER' : 'faster'} than flat removed`
        );
    }

    const header = [
        'GSplat flat varyings test - engine issue #10085',
        `Date: ${started.toISOString()}`,
        `Engine: ${version} (${revision})`,
        `Browser: ${navigator.userAgent}`,
        `Scene (${PROFILE.name} profile): ${NUM_SPLATS} synthetic splats, scale ${SPLAT_SCALE}, ${WIDTH}x${HEIGHT}, ` +
            `${WARMUP_FRAMES} warmup + ${MEASURE_FRAMES} measured frames, ${REPEATS} repeats per variant (alternating)`,
        'Values: median frame time in ms (lower is better)'
    ];
    const report = [...header, ...lines, '', 'RESULT', ...conclusions.map((c) => `  ${c}`)].join('\n');

    reportEl.textContent = report;
    console.log(`\n${report}\n`);
    lastReport = report;

    setStatus('Done. Please send a screenshot of this page, or use Copy report and paste the text.');
    running = false;
    buttons.run.disabled = false;
    buttons.copy.disabled = false;
};

buttons.run = makeButton('Run test', runTest);
buttons.copy = makeButton('Copy report', () => {
    navigator.clipboard?.writeText(lastReport).then(() => setStatus('Report copied to clipboard.'));
});
buttons.copy.disabled = true;

setStatus(
    `Press "Run test". It takes about 1-5 minutes; keep this tab in the foreground and do not use the computer meanwhile. ` +
        'The report is shown here and logged to the console.'
);
