// @config
//
// Experiment: measures the GPU sort renderer with its compute dispatches recorded into separate compute
// passes, against consecutive dispatches merged into a single compute pass.
//
// @flag NO_MINISTATS
// @flag NO_DEVICE_SELECTOR
// @flag WEBGPU_DISABLED
// @flag WEBGL_DISABLED
//
// @credit
// title: Roman Parish
// author: Andrii Shramko
// source: https://www.linkedin.com/in/andrii-shramko/

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    GSPLAT_RENDERER_RASTER_GPU_SORT,
    GSplatComponentSystem,
    GSplatHandler,
    LightComponentSystem,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    ScriptHandler,
    TextureHandler,
    Vec3,
    WebgpuGraphicsDevice,
    revision,
    version
} from 'playcanvas';

// splat budgets to measure, in millions
const BUDGETS = [1, 4, 10, 20];

// measurements of each mode for each budget, alternating the modes as separate, merged, merged,
// separate and so on, so that a steady drift, such as of the streamed detail, affects both equally
const ROUNDS = 4;

// frames per frame rate measurement, with the GPU profiler disabled
const WARMUP_FRAMES = 30;
const MEASURE_FRAMES = 300;

// frames per GPU profiler measurement
const PROFILE_WARMUP_FRAMES = 30;
const PROFILE_FRAMES = 120;

const MODES = [
    { merge: false, label: 'separate' },
    { merge: true, label: 'merged' }
];

// the camera of the benchmark example, static
const cameraPosition = new Vec3(10.3, 2, -10);
const cameraTarget = new Vec3(12, 3, 0);

// ---- UI ----

const panel = document.createElement('div');
Object.assign(panel.style, {
    position: 'fixed',
    top: '10px',
    left: '10px',
    zIndex: '300',
    maxWidth: 'calc(100% - 20px)',
    maxHeight: 'calc(100% - 20px)',
    overflow: 'auto',
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#eee',
    font: '12px/1.4 monospace',
    borderRadius: '4px'
});
document.body.appendChild(panel);

const title = document.createElement('div');
title.textContent = 'GSplat GPU sort - separate vs merged compute passes';
title.style.fontWeight = 'bold';
panel.appendChild(title);

const buttons = document.createElement('div');
buttons.style.margin = '8px 0';
panel.appendChild(buttons);

const runButton = document.createElement('button');
runButton.textContent = 'Run';
buttons.appendChild(runButton);

const downloadButton = document.createElement('button');
downloadButton.textContent = 'Download results';
downloadButton.disabled = true;
downloadButton.style.marginLeft = '8px';
buttons.appendChild(downloadButton);

const status = document.createElement('div');
status.textContent = 'Starting...';
panel.appendChild(status);

const output = document.createElement('pre');
output.style.margin = '8px 0 0';
panel.appendChild(output);

/**
 * @param {string} text - The status text.
 */
const setStatus = (text) => {
    status.textContent = text;
};

// ---- app ----

const canvas = document.createElement('canvas');
Object.assign(canvas.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '200' });
document.body.appendChild(canvas);

const device = new WebgpuGraphicsDevice(canvas, { antialias: false });
await device.initWebGpu('./assets/wasm/glslang/glslang.js', './assets/wasm/twgsl/twgsl.js');
const dpr = window.devicePixelRatio || 1;
device.maxPixelRatio = dpr >= 2 ? dpr * 0.5 : dpr;

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    GSplatComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, ScriptHandler, GSplatHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    device.mergeComputePasses = false;
    panel.remove();
    canvas.remove();
});

app.scene.gsplat.renderer = GSPLAT_RENDERER_RASTER_GPU_SORT;
app.scene.gsplat.splatBudget = BUDGETS[0] * 1000000;
app.scene.gsplat.lodBehindPenalty = 3;
app.scene.gsplat.radialSorting = true;

const assets = {
    bicycle: new Asset('bicycle', 'gsplat', { url: './assets/splats/bicycle.sog' }),
    logo: new Asset('logo', 'gsplat', { url: './assets/splats/playcanvas-logo/meta.json' }),
    church: new Asset('church', 'gsplat', {
        url: 'https://code.playcanvas.com/examples_data/example_roman_parish_03/lod-meta.json'
    })
};

setStatus('Loading assets...');
await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

const bicycle = new Entity('bicycle');
bicycle.addComponent('gsplat', { asset: assets.bicycle });
bicycle.setLocalPosition(11.2, 0, -3.5);
bicycle.setLocalEulerAngles(0, 90, 180);
bicycle.setLocalScale(2, 2, 2);
app.root.addChild(bicycle);

const logo = new Entity('logo');
logo.addComponent('gsplat', { asset: assets.logo });
logo.setLocalPosition(8, 0, 2.6);
logo.setLocalEulerAngles(180, 0, 0);
logo.setLocalScale(2, 2, 2);
app.root.addChild(logo);

const church = new Entity('church');
church.addComponent('gsplat', { asset: assets.church });
church.setLocalEulerAngles(-90, 0, 0);
app.root.addChild(church);

const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.1, 0.1, 0.1), fov: 75 });
camera.setLocalPosition(cameraPosition);
camera.lookAt(cameraTarget);
app.root.addChild(camera);

app.start();

const gsplatSystem = /** @type {any} */ (app.systems.gsplat);

// the names of the compute passes, to tell them apart from the render passes in the GPU timings
/** @type {Set<string>} */
const computePassNames = new Set();
const dev = /** @type {any} */ (device);
const startComputePass = dev.startComputePass.bind(device);
dev.startComputePass = (/** @type {string} */ name) => {
    computePassNames.add(name);
    startComputePass(name);
};

// ---- measurement ----

/**
 * Resolves once the LOD streaming has settled: a ready frame with nothing loading, after which the
 * number of rendered splats stays the same for the given time. After a change of the budget, it
 * first waits to see the streaming react to it.
 *
 * @param {string} label - The status label.
 * @param {boolean} expectChange - True to wait for a frame which is not ready first.
 * @param {number} stableMs - How long the number of rendered splats needs to stay the same.
 * @param {number} timeoutMs - The time after which to resolve regardless.
 * @returns {Promise<void>} Resolves when settled, or after the timeout.
 */
const waitForSettled = (label, expectChange, stableMs, timeoutMs) =>
    new Promise((resolve) => {
        let sawNotReady = !expectChange;
        let ready = false;
        let loading = 0;
        let lastSplats = -1;
        let stableSince = 0;
        let frame = 0;
        const start = performance.now();
        const onReady = (
            /** @type {any} */ cam,
            /** @type {any} */ layer,
            /** @type {boolean} */ isReady,
            /** @type {number} */ loadingCount
        ) => {
            loading = loadingCount;
            if (!isReady || loadingCount > 0) {
                sawNotReady = true;
                ready = false;
            } else if (sawNotReady) {
                ready = true;
            }
        };
        const onFrame = () => {
            const now = performance.now();
            const splats = app.stats.frame.gsplats;
            if (!ready || Math.abs(splats - lastSplats) > lastSplats * 0.001) {
                stableSince = now;
                lastSplats = splats;
            }
            if (++frame % 30 === 0) {
                setStatus(`${label}  streaming: ${(splats / 1000000).toFixed(2)}M splats, ${loading} loading`);
            }
            if ((ready && now - stableSince > stableMs) || now - start > timeoutMs) {
                gsplatSystem.off('frame:ready', onReady);
                app.off('frameend', onFrame);
                resolve();
            }
        };
        gsplatSystem.on('frame:ready', onReady);
        app.on('frameend', onFrame);
    });

// The GPU timings arrive several frames late, so each is collected by the measurement active when
// its frame was requested.
/** @type {Map<number, any>} */
const profiledFrames = new Map();
/** @type {any} */
let activeCollector = null;
const profiler = /** @type {any} */ (device.gpuProfiler);
const profilerRequest = profiler.request.bind(profiler);
profiler.request = () => {
    if (activeCollector) {
        profiledFrames.set(device.renderVersion, activeCollector);
        activeCollector.requested++;
    }
    profilerRequest();
};
const profilerReport = profiler.report.bind(profiler);
profiler.report = (
    /** @type {number} */ renderVersion,
    /** @type {any} */ timings,
    /** @type {number} */ frameTime
) => {
    profilerReport(renderVersion, timings, frameTime);
    const collector = profiledFrames.get(renderVersion);
    if (collector) {
        profiledFrames.delete(renderVersion);
        if (timings) {
            collector.samples++;
            collector.gpuFrame += profiler._frameTime;
            profiler._passTimings.forEach((/** @type {number} */ time, /** @type {string} */ name) => {
                collector.passTimes.set(name, (collector.passTimes.get(name) ?? 0) + time);
            });
        }
    }
};

/**
 * @param {boolean} merge - True to merge consecutive compute dispatches into a single compute pass.
 */
const setMerge = (merge) => {
    device.mergeComputePasses = merge;
};

/**
 * @param {boolean} enabled - True to enable the GPU profiler.
 */
const setProfiling = (enabled) => {
    device.gpuProfiler.enabled = enabled;
};

/**
 * Measures the frames, after warming up. With the GPU profiler, it collects the timings of the
 * measured frames, which arrive later.
 *
 * @param {string} label - The status label.
 * @param {number} warmup - The frames to skip first.
 * @param {number} frames - The frames to measure.
 * @param {boolean} profile - True to collect the GPU profiler timings.
 * @returns {Promise<any>} The measured values.
 */
const measure = (label, warmup, frames, profile) =>
    new Promise((resolve) => {
        let frame = 0;
        let wallStart = 0;
        let seconds = 0;
        let passes = 0;
        let dispatches = 0;
        let splats = 0;
        let measuring = true;
        const collector = { requested: 0, samples: 0, gpuFrame: 0, passTimes: new Map() };

        const finish = () => {
            app.off('frameend', onFrame); // eslint-disable-line no-use-before-define
            /** @type {Map<string, number>} */
            const passTimes = new Map();
            collector.passTimes.forEach((time, name) => passTimes.set(name, time / Math.max(1, collector.samples)));
            resolve({
                fps: frames / seconds,
                ms: (seconds * 1000) / frames,
                passes: passes / frames,
                dispatches: dispatches / frames,
                splats: splats / frames,
                gpuMs: collector.samples ? collector.gpuFrame / collector.samples : -1,
                passTimes
            });
        };

        const onFrame = () => {
            frame++;
            if (frame <= warmup) {
                if (frame === warmup) {
                    wallStart = performance.now();
                    if (profile) {
                        activeCollector = collector;
                    }
                }
                return;
            }

            if (measuring) {
                const index = frame - warmup;
                if (index % 30 === 0) {
                    setStatus(`${label}  ${index}/${frames}`);
                }

                // the counters of the previous frame, published at the start of this one
                passes += app.stats.computePassCount;
                dispatches += app.stats.computeDispatchCount;
                splats += app.stats.frame.gsplats;

                if (index >= frames) {
                    measuring = false;
                    seconds = (performance.now() - wallStart) / 1000;
                    activeCollector = null;
                }
            }

            // done, once the timings of the measured frames arrived, or after 600 more frames
            if (!measuring && (!profile || collector.samples >= collector.requested || frame > warmup + frames + 600)) {
                finish();
            }
        };
        app.on('frameend', onFrame);
    });

/**
 * @returns {string} The name of the radix sort implementation of the GPU sort renderer.
 */
const getSorterName = () => {
    let name = '?';
    app.renderer.gsplatDirector?.camerasMap.forEach((cameraData) => {
        cameraData.layersMap.forEach((layerData) => {
            const impl = layerData.gsplatManager?.renderer?.gpuSorter?._impl;
            if (impl) name = impl.constructor.name;
        });
    });
    return name;
};

/**
 * @param {number} value - The value.
 * @param {number} digits - The decimal places.
 * @param {number} width - The width to pad to.
 * @returns {string} The formatted value.
 */
const fmt = (value, digits, width) => value.toFixed(digits).padStart(width);

/**
 * @param {number} a - The value of separate passes.
 * @param {number} b - The value of merged passes.
 * @returns {string} The change from a to b, in percent.
 */
const pct = (a, b) => `${b >= a ? '+' : ''}${(((b - a) / a) * 100).toFixed(2)}%`;

let resultsText = '';

const run = async () => {
    runButton.disabled = true;
    downloadButton.disabled = true;

    const info = device.gpuAdapter?.info;
    const lines = [
        'GSplat GPU sort - separate vs merged compute passes',
        `Date: ${new Date().toISOString()}`,
        `Engine: ${version} (${revision})`,
        `Browser: ${navigator.userAgent}`,
        `GPU: ${info ? [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(', ') : '?'}`,
        `Canvas: ${device.width} x ${device.height}`,
        `Frame rate: ${ROUNDS} alternating rounds per mode, ${MEASURE_FRAMES} frames each after ${WARMUP_FRAMES} warmup, GPU profiler off, static camera.`,
        'Frame rate measures throughput only when Chrome runs with vsync and the frame rate limit disabled.',
        ''
    ];

    /** @type {any[]} */
    const summary = [];

    for (let b = 0; b < BUDGETS.length; b++) {
        const millions = BUDGETS[b];
        app.scene.gsplat.splatBudget = millions * 1000000;
        // the streaming of a larger budget can take minutes
        await waitForSettled(`${millions}M`, b > 0, 10000, 300000); // eslint-disable-line no-await-in-loop

        // frame rate, alternating the modes, with the GPU profiler disabled
        setProfiling(false);
        /** @type {any[][]} */
        const runs = MODES.map(() => []);
        for (let r = 0; r < ROUNDS; r++) {
            const order = r % 2 === 0 ? [0, 1] : [1, 0];
            for (const m of order) {
                setMerge(MODES[m].merge);
                const label = `${millions}M  ${MODES[m].label}  round ${r + 1}/${ROUNDS}`;
                await waitForSettled(label, false, 2000, 60000); // eslint-disable-line no-await-in-loop
                const result = await measure(label, WARMUP_FRAMES, MEASURE_FRAMES, false); // eslint-disable-line no-await-in-loop
                runs[m].push(result);
            }
        }

        // GPU timings, with the GPU profiler enabled
        setProfiling(true);
        const profiles = [];
        for (let m = 0; m < MODES.length; m++) {
            setMerge(MODES[m].merge);
            const label = `${millions}M  ${MODES[m].label}  GPU profiler`;
            await waitForSettled(label, false, 2000, 60000); // eslint-disable-line no-await-in-loop
            const result = await measure(label, PROFILE_WARMUP_FRAMES, PROFILE_FRAMES, true); // eslint-disable-line no-await-in-loop
            profiles.push(result);
        }
        setProfiling(false);
        setMerge(false);

        summary.push({ millions, runs, profiles, sorter: getSorterName() });
    }

    // frame rate table
    lines.push(`Sorter: ${summary[0]?.sorter ?? '?'}`);
    lines.push('');
    lines.push('Budget  Splats(M)  Mode       FPS(avg)  ms/frame  FPS per round              Passes  Dispatches');
    for (const s of summary) {
        const avg = s.runs.map((r) => r.reduce((a, x) => a + x.fps, 0) / r.length);
        const splats = s.runs.map((r) => r.reduce((a, x) => a + x.splats, 0) / r.length);
        s.runs.forEach((r, m) => {
            const first = r[0];
            lines.push(
                `${`${s.millions}M`.padEnd(8)}${fmt(splats[m] / 1000000, 2, 9)}  ${MODES[m].label.padEnd(9)}${fmt(avg[m], 1, 10)}${fmt(1000 / avg[m], 3, 10)}  ${r
                    .map((x) => fmt(x.fps, 1, 8))
                    .join(' ')
                    .padEnd(25)}${fmt(first.passes, 1, 8)}${fmt(first.dispatches, 1, 12)}`
            );
        });
        lines.push(
            `${''.padEnd(19)}merged vs separate: FPS ${pct(avg[0], avg[1])}, ms/frame ${pct(1000 / avg[0], 1000 / avg[1])}`
        );
        if (Math.abs(splats[1] - splats[0]) > splats[0] * 0.01) {
            lines.push(
                `${''.padEnd(19)}warning: the modes rendered different splat counts, so they are not comparable`
            );
        }
    }

    // GPU profiler table
    lines.push('');
    lines.push(
        `GPU profiler (${PROFILE_FRAMES} frames per mode, static camera). Timestamps are written for each pass, which`
    );
    lines.push('adds GPU time per pass, so these favour fewer passes - use the frame rate above as the main result.');
    lines.push('');
    lines.push('Budget  Mode       GPU frame ms  Compute ms  Render ms');
    for (const s of summary) {
        s.profiles.forEach((p, m) => {
            let compute = 0;
            let other = 0;
            p.passTimes.forEach((/** @type {number} */ time, /** @type {string} */ name) => {
                if (computePassNames.has(name)) {
                    compute += time;
                } else {
                    other += time;
                }
            });
            lines.push(
                `${`${s.millions}M`.padEnd(8)}${MODES[m].label.padEnd(9)}${fmt(p.gpuMs, 3, 14)}${fmt(compute, 3, 12)}${fmt(other, 3, 10)}`
            );
        });
    }

    // per-pass timings of the largest budget
    const last = summary[summary.length - 1];
    if (last) {
        for (let m = 0; m < MODES.length; m++) {
            lines.push('');
            lines.push(`GPU ms per pass, ${last.millions}M, ${MODES[m].label}:`);
            last.profiles[m].passTimes.forEach((/** @type {number} */ time, /** @type {string} */ name) => {
                lines.push(`  ${name.padEnd(44)}${fmt(time, 3, 8)}`);
            });
        }
    }

    resultsText = lines.join('\n');
    output.textContent = resultsText;
    setStatus('Done - download the results and send them.');
    runButton.disabled = false;
    downloadButton.disabled = false;
};

runButton.addEventListener('click', () => {
    run();
});

downloadButton.addEventListener('click', () => {
    const blob = new Blob([resultsText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gsplat-compute-pass-merge-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
});

setStatus('Ready - press Run. The run takes a few minutes; keep this window visible and in front.');

export { app };
