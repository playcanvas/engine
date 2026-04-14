// @config NO_MINISTATS
// @config NO_DEVICE_SELECTOR
// @config WEBGPU_DISABLED
// @config WEBGL_DISABLED
// @config DESCRIPTION Benchmarks GSplat rendering across WebGL2 and WebGPU with different renderer modes. Loads a bicycle + 4 logo splats and measures CPU/GPU frame times.
import { rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const WARMUP_FRAMES = 20;
const MEASURE_FRAMES = 50;

// Renderer constants (numeric values used directly since not all are exported from pc namespace)
const RENDERER_RASTER_CPU_SORT = 1;
const RENDERER_RASTER_GPU_SORT = 2;
const RENDERER_COMPUTE = 3;

const RUNS = [
    { device: 'webgl2', renderer: RENDERER_RASTER_CPU_SORT, label: 'WebGL2 CPU Sort' },
    { device: 'webgpu', renderer: RENDERER_RASTER_CPU_SORT, label: 'WebGPU CPU Sort' },
    { device: 'webgpu', renderer: RENDERER_RASTER_GPU_SORT, label: 'WebGPU GPU Sort' },
    { device: 'webgpu', renderer: RENDERER_COMPUTE, label: 'WebGPU Compute' }
];

// Status overlay
const statusEl = document.createElement('div');
Object.assign(statusEl.style, {
    position: 'fixed',
    top: '10%',
    left: '10px',
    zIndex: '100',
    color: '#fff',
    background: 'rgba(0,0,0,0.85)',
    padding: '16px 20px',
    fontFamily: 'monospace',
    fontSize: '14px',
    borderRadius: '8px',
    whiteSpace: 'pre',
    lineHeight: '1.5',
    maxHeight: '90vh',
    overflow: 'auto'
});
document.body.appendChild(statusEl);

/**
 * @param {string} text - Status text.
 */
function setStatus(text) {
    statusEl.textContent = text;
}

// Remove existing canvas from example framework
const existingCanvas = document.getElementById('application-canvas');
if (existingCanvas) {
    existingCanvas.remove();
}

/**
 * @param {HTMLCanvasElement} canvas - The canvas.
 * @param {string} deviceType - 'webgpu' or 'webgl2'.
 * @returns {Promise<pc.GraphicsDevice>} The device.
 */
async function createDevice(canvas, deviceType) {
    if (deviceType === 'webgpu') {
        const device = new pc.WebgpuGraphicsDevice(canvas, {});
        await device.initWebGpu(
            `${rootPath}/static/lib/glslang/glslang.js`,
            `${rootPath}/static/lib/twgsl/twgsl.js`
        );
        return device;
    }
    return new pc.WebglGraphicsDevice(canvas);
}

/**
 * Extract GPU info string from a graphics device.
 *
 * @param {pc.GraphicsDevice} device - The device.
 * @returns {string} GPU info summary.
 */
function getGpuInfo(device) {
    const dev = /** @type {any} */ (device);
    if (device.isWebGPU) {
        const info = dev.gpuAdapter?.info;
        if (info) {
            return [
                `vendor: ${info.vendor || '?'}`,
                `architecture: ${info.architecture || '?'}`,
                `device: ${info.device || '?'}`,
                `description: ${info.description || '?'}`
            ].join(', ');
        }
        return 'WebGPU (no adapter info)';
    }
    const renderer = dev.unmaskedRenderer || '?';
    const vendor = dev.unmaskedVendor || '?';
    return `renderer: ${renderer}, vendor: ${vendor}`;
}

/**
 * Run a single benchmark configuration.
 *
 * @param {{ device: string, renderer: number, label: string }} config - Run config.
 * @returns {Promise<object>} Results.
 */
async function runBenchmark(config) {
    setStatus(`Running: ${config.label}\n  Creating device...`);

    const canvas = document.createElement('canvas');
    canvas.id = `bench-${Date.now()}`;
    Object.assign(canvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%'
    });
    document.getElementById('appInner')?.appendChild(canvas);

    const device = await createDevice(canvas, config.device);
    const isWebGPU = device.isWebGPU;
    const gpuInfo = getGpuInfo(device);

    const dev = /** @type {any} */ (device);
    let computePerfIndex = -1;
    if (isWebGPU && dev.computePerfIndex !== undefined) {
        computePerfIndex = dev.computePerfIndex;
    }

    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem,
        pc.GSplatComponentSystem
    ];
    createOptions.resourceHandlers = [
        pc.TextureHandler,
        pc.ContainerHandler,
        pc.ScriptHandler,
        pc.GSplatHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);

    // Set renderer before loading assets
    app.scene.gsplat.renderer = config.renderer;

    // Enable GPU profiler for timing
    if (device.gpuProfiler) {
        device.gpuProfiler.enabled = true;
    }

    // Load assets
    const bicycleAsset = new pc.Asset('bicycle', 'gsplat', {
        url: `${rootPath}/static/assets/splats/bicycle.sog`
    });
    const logoAsset = new pc.Asset('logo', 'gsplat', {
        url: `${rootPath}/static/assets/splats/playcanvas-logo/meta.json`
    });

    setStatus(`Running: ${config.label}\n  Loading assets...`);

    await new Promise((resolve) => {
        new pc.AssetListLoader([bicycleAsset, logoAsset], app.assets).load(resolve);
    });

    // Bicycle — 2x scale
    const bicycle = new pc.Entity('bicycle');
    bicycle.addComponent('gsplat', { asset: bicycleAsset, unified: true });
    bicycle.setLocalEulerAngles(0, 0, 180);
    bicycle.setLocalScale(2, 2, 2);
    app.root.addChild(bicycle);

    // 4 upright logos behind the bicycle, scaled up to fill more of the screen
    const logoConfigs = [
        { pos: [20, -6, 0], scale: 10 },
        { pos: [12, -6, 4], scale: 5 },
        { pos: [4, -3, 1], scale: 1.5 },
        { pos: [4, -2, -3], scale: 1 }
    ];
    for (const cfg of logoConfigs) {
        const logo = new pc.Entity('logo');
        logo.addComponent('gsplat', { asset: logoAsset, unified: true });
        logo.setLocalPosition(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        logo.setLocalEulerAngles(180, 90, 0);
        logo.setLocalScale(cfg.scale, cfg.scale, cfg.scale);
        app.root.addChild(logo);
    }

    // Camera — side view along the X axis
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1),
        fov: 60
    });
    camera.setLocalPosition(-4, 1.2, 0);
    camera.lookAt(new pc.Vec3(0, 1.2, 0));
    app.root.addChild(camera);

    app.start();

    // Warmup + measurement
    const cpuTimes = [];
    const gpuTimes = [];
    /** @type {Map<string, number[]>} */
    const passTimingsAccum = new Map();

    await new Promise((resolve) => {
        let frameCount = 0;

        app.on('frameend', () => {
            frameCount++;

            if (frameCount <= WARMUP_FRAMES) {
                setStatus(`Running: ${config.label}\n  Warming up... ${frameCount}/${WARMUP_FRAMES}`);
                return;
            }

            const measureIdx = frameCount - WARMUP_FRAMES;
            setStatus(`Running: ${config.label}\n  Measuring... ${measureIdx}/${MEASURE_FRAMES}`);

            cpuTimes.push(app.stats.frame.ms);

            if (device.gpuProfiler) {
                const gpuTime = device.gpuProfiler._frameTime;
                if (gpuTime > 0) {
                    gpuTimes.push(gpuTime);
                }

                // Accumulate per-pass timings
                const passMap = device.gpuProfiler.passTimings;
                for (const [name, time] of passMap) {
                    let arr = passTimingsAccum.get(name);
                    if (!arr) {
                        arr = [];
                        passTimingsAccum.set(name, arr);
                    }
                    arr.push(time);
                }
            }

            if (measureIdx >= MEASURE_FRAMES) {
                resolve();
            }
        });
    });

    // Compute averages
    const avgCpu = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;
    const avgGpu = gpuTimes.length > 0 ?
        gpuTimes.reduce((a, b) => a + b, 0) / gpuTimes.length :
        -1;

    /** @type {Map<string, number>} */
    const avgPassTimings = new Map();
    for (const [name, times] of passTimingsAccum) {
        avgPassTimings.set(name, times.reduce((a, b) => a + b, 0) / times.length);
    }

    // Cleanup
    window.removeEventListener('resize', resize);
    app.destroy();
    canvas.remove();

    return {
        label: config.label,
        deviceType: config.device,
        gpuInfo,
        avgCpu,
        avgGpu,
        avgPassTimings,
        computePerfIndex
    };
}

// ── Main benchmark sequence ──

const allResults = [];
let computePerfIndex = -1;
const gpuInfos = {};

for (let i = 0; i < RUNS.length; i++) {
    const run = RUNS[i];
    try {
        const result = await runBenchmark(run); // eslint-disable-line no-await-in-loop
        allResults.push(result);
        if (result.computePerfIndex >= 0) {
            computePerfIndex = result.computePerfIndex;
        }
        if (!gpuInfos[run.device]) {
            gpuInfos[run.device] = result.gpuInfo;
        }
    } catch (e) {
        console.error(`Benchmark failed for ${run.label}:`, e);
        allResults.push({
            label: run.label,
            deviceType: run.device,
            gpuInfo: '(failed)',
            avgCpu: -1,
            avgGpu: -1,
            avgPassTimings: new Map(),
            computePerfIndex: -1,
            error: e.message
        });
    }
}

// ── Format results ──

/**
 * @param {number} v - Value.
 * @returns {string} Formatted.
 */
function fmt(v) {
    return v >= 0 ? v.toFixed(2) : '\u2014';
}

let screenText = 'GSplat Benchmark Results\n';
screenText += `${'\u2550'.repeat(50)}\n`;

// GPU info
if (gpuInfos.webgl2) {
    screenText += `WebGL2:  ${gpuInfos.webgl2}\n`;
}
if (gpuInfos.webgpu) {
    screenText += `WebGPU:  ${gpuInfos.webgpu}\n`;
}
screenText += `Compute Perf Index: ${computePerfIndex >= 0 ? computePerfIndex.toFixed(3) : '\u2014'} ms\n`;
screenText += `${'\u2550'.repeat(50)}\n`;

// Results table
screenText += `${'Run'.padEnd(22)} ${'CPU (ms)'.padStart(10)} ${'GPU (ms)'.padStart(10)}\n`;
screenText += `${'\u2500'.repeat(50)}\n`;

for (const r of allResults) {
    if (r.error) {
        screenText += `${r.label.padEnd(22)} ${'FAILED'.padStart(10)} ${''.padStart(10)}\n`;
    } else {
        screenText += `${r.label.padEnd(22)} ${fmt(r.avgCpu).padStart(10)} ${fmt(r.avgGpu).padStart(10)}\n`;
    }
}
screenText += `${'\u2500'.repeat(50)}\n`;

// Build detailed download text
let dlText = screenText;
dlText += `\n\n${'='.repeat(50)}\n`;
dlText += 'Per-Pass GPU Timings (WebGPU runs)\n';
dlText += `${'='.repeat(50)}\n`;

for (const r of allResults) {
    if (r.deviceType !== 'webgpu' || r.avgPassTimings.size === 0) continue;
    dlText += `\n--- ${r.label} ---\n`;
    const sorted = [...r.avgPassTimings.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, time] of sorted) {
        dlText += `  ${name.padEnd(45)} ${time.toFixed(3)} ms\n`;
    }
}

dlText += `\nConfig: ${WARMUP_FRAMES} warmup + ${MEASURE_FRAMES} measured frames\n`;
dlText += `UserAgent: ${navigator.userAgent}\n`;
dlText += `Date: ${new Date().toISOString()}\n`;

// Display results + download button
statusEl.textContent = screenText;

const dlBtn = document.createElement('button');
dlBtn.textContent = 'Download Results';
Object.assign(dlBtn.style, {
    display: 'block',
    marginTop: '12px',
    padding: '8px 16px',
    background: '#4a9eff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '13px'
});
dlBtn.onclick = () => {
    const blob = new Blob([dlText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gsplat-benchmark-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
};
statusEl.appendChild(dlBtn);

console.log(dlText);

const destroy = () => {
    statusEl.remove();
};

export { destroy };
