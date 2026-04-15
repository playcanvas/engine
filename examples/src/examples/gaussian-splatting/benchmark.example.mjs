// @config NO_MINISTATS
// @config NO_DEVICE_SELECTOR
// @config WEBGPU_DISABLED
// @config WEBGL_DISABLED
// @config DESCRIPTION Benchmarks GSplat rendering across WebGL2 and WebGPU with different renderer modes and splat counts.
import { rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const WARMUP_FRAMES = 10;
const MEASURE_FRAMES = 30;

const RENDERER_RASTER_CPU_SORT = 1;
const RENDERER_RASTER_GPU_SORT = 2;
const RENDERER_COMPUTE = 3;

const RENDERERS = [
    { device: 'webgl2', renderer: RENDERER_RASTER_CPU_SORT, label: 'WebGL2 CPU Sort', shortLabel: 'GL2 CPU' },
    { device: 'webgpu', renderer: RENDERER_RASTER_CPU_SORT, label: 'WebGPU CPU Sort', shortLabel: 'GPU CPU' },
    { device: 'webgpu', renderer: RENDERER_RASTER_GPU_SORT, label: 'WebGPU GPU Sort', shortLabel: 'GPU Sort' },
    { device: 'webgpu', renderer: RENDERER_COMPUTE, label: 'WebGPU Compute', shortLabel: 'Compute' }
];

const BUDGETS = [2, 4, 6, 8, 10, 20]; // millions

// ── Stored results per renderer column ──
// storedResults[col].budgetResults is length BUDGETS.length, entries are null or result object

/** @type {(object|null)[]} */
const storedResults = new Array(RENDERERS.length).fill(null);
let storedComputePerfIndex = -1;
/** @type {Record<string, string>} */
const storedGpuInfos = {};
let running = false;

// ── UI ──

const containerEl = document.createElement('div');
Object.assign(containerEl.style, {
    position: 'fixed',
    top: '10%',
    left: '0',
    width: '100%',
    height: '90%',
    zIndex: '100',
    color: '#fff',
    background: '#111',
    fontFamily: 'monospace',
    fontSize: '13px',
    overflow: 'auto',
    padding: '20px',
    boxSizing: 'border-box'
});
document.body.appendChild(containerEl);

const styleEl = document.createElement('style');
styleEl.textContent = '.bench-cell { background: #1a1a2e; border-radius: 3px; transition: background 0.15s; } .bench-cell:hover { background: #2a2a4e; }';
document.head.appendChild(styleEl);

const titleEl = document.createElement('h2');
titleEl.textContent = 'GSplat Benchmark';
Object.assign(titleEl.style, { margin: '0 0 4px 0', fontSize: '20px', fontWeight: 'normal' });
containerEl.appendChild(titleEl);

const gpuInfoEl = document.createElement('div');
Object.assign(gpuInfoEl.style, { marginBottom: '12px', color: '#888', fontSize: '12px', whiteSpace: 'pre' });
containerEl.appendChild(gpuInfoEl);

// Shared button style for header buttons
const headerBtnCss = [
    'background: #4a9eff',
    'color: #fff',
    'border: none',
    'border-radius: 3px',
    'cursor: pointer',
    'font-family: monospace',
    'font-size: 14px',
    'padding: 6px 14px',
    'width: 100%',
    'white-space: nowrap'
].join(';');

// Grid table
const table = document.createElement('table');
Object.assign(table.style, { borderCollapse: 'collapse', marginBottom: '12px', fontSize: '15px' });

const cellPad = 'padding: 10px 16px; border: 1px solid #333; text-align: center; min-width: 120px;';
const headerCellCss = `${cellPad} background: #222;`;

// Header row
const thead = document.createElement('thead');
const headTr = document.createElement('tr');

// Corner: Run All
const cornerTh = document.createElement('th');
cornerTh.style.cssText = headerCellCss;
const runAllBtn = document.createElement('button');
runAllBtn.textContent = 'Run All';
runAllBtn.style.cssText = headerBtnCss;
cornerTh.appendChild(runAllBtn);
headTr.appendChild(cornerTh);

/** @type {HTMLButtonElement[]} */
const allBtns = [runAllBtn];

for (let c = 0; c < RENDERERS.length; c++) {
    const th = document.createElement('th');
    th.style.cssText = headerCellCss;
    const btn = document.createElement('button');
    btn.textContent = RENDERERS[c].shortLabel;
    btn.style.cssText = headerBtnCss;
    btn.onclick = () => runColumn(c);
    th.appendChild(btn);
    headTr.appendChild(th);
    allBtns.push(btn);
}
thead.appendChild(headTr);
table.appendChild(thead);

// Body rows
const tbody = document.createElement('tbody');

/** @type {Map<string, HTMLTableCellElement>} */
const cellEls = new Map();

// Budget rows (clickable row headers + clickable cells)
for (let b = 0; b < BUDGETS.length; b++) {
    const tr = document.createElement('tr');
    const th = document.createElement('td');
    th.style.cssText = headerCellCss;
    const rowBtn = document.createElement('button');
    rowBtn.textContent = `${BUDGETS[b]}M`;
    rowBtn.style.cssText = headerBtnCss;
    rowBtn.onclick = () => runRow(b);
    th.appendChild(rowBtn);
    tr.appendChild(th);
    allBtns.push(rowBtn);

    for (let c = 0; c < RENDERERS.length; c++) {
        const td = document.createElement('td');
        td.style.cssText = `${cellPad} color: #555; cursor: pointer;`;
        td.className = 'bench-cell';
        td.textContent = '\u2014';
        td.title = `Run ${RENDERERS[c].shortLabel} @ ${BUDGETS[b]}M`;
        td.onclick = () => runCell(c, b);
        tr.appendChild(td);
        cellEls.set(`${BUDGETS[b]}M:${c}`, td);
    }
    tbody.appendChild(tr);
}
table.appendChild(tbody);
containerEl.appendChild(table);

// Status line (inside container, visible when idle)
const statusEl = document.createElement('div');
Object.assign(statusEl.style, {
    marginBottom: '12px',
    color: '#aaa',
    whiteSpace: 'pre',
    lineHeight: '1.4',
    minHeight: '1.4em',
    fontSize: '14px'
});
containerEl.appendChild(statusEl);

// Floating status overlay (visible during tests, on top of rendering)
const floatingStatus = document.createElement('div');
Object.assign(floatingStatus.style, {
    position: 'fixed',
    top: '10%',
    left: '10px',
    zIndex: '200',
    color: '#fff',
    background: 'rgba(0, 0, 0, 0.7)',
    fontFamily: 'monospace',
    fontSize: '14px',
    padding: '8px 14px',
    borderRadius: '4px',
    display: 'none',
    pointerEvents: 'none'
});
document.body.appendChild(floatingStatus);

// Chart + download area
const chartArea = document.createElement('div');
containerEl.appendChild(chartArea);

/**
 * @param {string} text - Status text.
 */
function setStatus(text) {
    statusEl.textContent = text;
    floatingStatus.textContent = text;
}

/**
 * @param {boolean} testing - True when tests are running.
 */
function setTestingMode(testing) {
    containerEl.style.display = testing ? 'none' : '';
    floatingStatus.style.display = testing ? 'block' : 'none';
}

/**
 * @param {string} key - Cell key "rowLabel:colIndex".
 * @param {string} text - Cell text.
 * @param {string} [color] - Text color.
 */
function setCell(key, text, color) {
    const td = cellEls.get(key);
    if (td) {
        td.textContent = text;
        td.style.color = color || '#fff';
    }
}

/**
 * @param {boolean} enabled - Whether buttons should be enabled.
 */
function setButtonsEnabled(enabled) {
    for (const btn of allBtns) {
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.4';
        btn.style.cursor = enabled ? 'pointer' : 'default';
    }
    for (const [, td] of cellEls) {
        td.style.cursor = enabled ? 'pointer' : 'default';
        td.style.pointerEvents = enabled ? 'auto' : 'none';
    }
}

const existingCanvas = document.getElementById('application-canvas');
if (existingCanvas) {
    existingCanvas.remove();
}

// ── Helpers ──

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
    return `renderer: ${dev.unmaskedRenderer || '?'}, vendor: ${dev.unmaskedVendor || '?'}`;
}

/**
 * @param {pc.AppBase} app - The app.
 * @param {pc.GraphicsDevice} device - The device.
 * @param {string} label - Status label.
 * @param {string} budgetLabel - Budget label.
 * @returns {Promise<{avgCpu: number, avgGpu: number, avgSplats: number, avgPassTimings: Map<string, number>}>} Results.
 */
function measureFrames(app, device, label, budgetLabel) {
    return new Promise((resolve) => {
        const cpuTimes = [];
        const gpuTimes = [];
        const splatCounts = [];
        /** @type {Map<string, number[]>} */
        const passAccum = new Map();
        let frame = 0;

        const onFrame = () => {
            frame++;
            if (frame <= WARMUP_FRAMES) {
                setStatus(`${label} [${budgetLabel}]  Warming up ${frame}/${WARMUP_FRAMES}`);
                return;
            }
            const idx = frame - WARMUP_FRAMES;
            setStatus(`${label} [${budgetLabel}]  Measuring ${idx}/${MEASURE_FRAMES}`);

            cpuTimes.push(app.stats.frame.ms);
            splatCounts.push(app.stats.frame.gsplats);

            if (device.gpuProfiler) {
                const gt = device.gpuProfiler._frameTime;
                if (gt > 0) gpuTimes.push(gt);

                for (const [name, time] of device.gpuProfiler.passTimings) {
                    let arr = passAccum.get(name);
                    if (!arr) {
                        arr = [];
                        passAccum.set(name, arr);
                    }
                    arr.push(time);
                }
            }

            if (idx >= MEASURE_FRAMES) {
                app.off('frameend', onFrame);
                const avgCpu = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;
                const avgGpu = gpuTimes.length > 0 ?
                    gpuTimes.reduce((a, b) => a + b, 0) / gpuTimes.length : -1;
                const avgSplats = splatCounts.reduce((a, b) => a + b, 0) / splatCounts.length;
                /** @type {Map<string, number>} */
                const avgPass = new Map();
                for (const [name, times] of passAccum) {
                    avgPass.set(name, times.reduce((a, b) => a + b, 0) / times.length);
                }
                resolve({ avgCpu, avgGpu, avgSplats, avgPassTimings: avgPass });
            }
        };
        app.on('frameend', onFrame);
    });
}

/**
 * @param {any} gsplatSystem - The gsplat system.
 * @param {pc.AppBase} app - The app.
 * @param {string} statusPrefix - Prefix for status message.
 * @param {number} [timeoutMs] - Max wait in ms.
 * @returns {Promise<void>}
 */
function waitForReady(gsplatSystem, app, statusPrefix, timeoutMs = 10000) {
    return new Promise((resolve) => {
        let resolved = false;
        let sawNotReady = false;

        const onReady = (/** @type {any} */ cam, /** @type {any} */ layer, /** @type {boolean} */ ready, /** @type {number} */ loadingCount) => {
            const splats = (app.stats.frame.gsplats / 1000000).toFixed(1);
            setStatus(`${statusPrefix}  Waiting... (${splats}M splats)`);

            if (!ready || loadingCount > 0) {
                sawNotReady = true;
            }
            if (sawNotReady && ready && loadingCount === 0) {
                if (resolved) return;
                resolved = true;
                gsplatSystem.off('frame:ready', onReady);
                resolve();
            }
        };

        gsplatSystem.on('frame:ready', onReady);
        setTimeout(() => {
            if (resolved) return;
            resolved = true;
            gsplatSystem.off('frame:ready', onReady);
            resolve();
        }, timeoutMs);
    });
}

/**
 * Run benchmark for one renderer column across specified budgets.
 *
 * @param {{ device: string, renderer: number, label: string, shortLabel: string }} config - Config.
 * @param {number} colIndex - Column index.
 * @param {number[]} budgetIndices - Which budget indices to run.
 * @returns {Promise<void>}
 */
async function runBenchmark(config, colIndex, budgetIndices) {
    setStatus(`${config.label}  Creating device...`);

    for (const bi of budgetIndices) {
        setCell(`${BUDGETS[bi]}M:${colIndex}`, '...', '#666');
    }

    const canvas = document.createElement('canvas');
    canvas.id = `bench-${Date.now()}`;
    Object.assign(canvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '50'
    });
    document.getElementById('appInner')?.appendChild(canvas);

    const device = await createDevice(canvas, config.device);
    const gpuInfo = getGpuInfo(device);

    const dev = /** @type {any} */ (device);
    let computePerfIndex = -1;
    if (device.isWebGPU && dev.computePerfIndex !== undefined) {
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

    app.scene.gsplat.renderer = config.renderer;
    app.scene.gsplat.splatBudget = BUDGETS[budgetIndices[0]] * 1000000;

    if (device.gpuProfiler) {
        device.gpuProfiler.enabled = true;
    }

    const bicycleAsset = new pc.Asset('bicycle', 'gsplat', {
        url: `${rootPath}/static/assets/splats/bicycle.sog`
    });
    const logoAsset = new pc.Asset('logo', 'gsplat', {
        url: `${rootPath}/static/assets/splats/playcanvas-logo/meta.json`
    });
    const churchAsset = new pc.Asset('church', 'gsplat', {
        url: 'https://code.playcanvas.com/examples_data/example_roman_parish_02/lod-meta.json'
    });

    setStatus(`${config.label}  Loading assets...`);
    await new Promise((resolve) => {
        new pc.AssetListLoader([bicycleAsset, logoAsset, churchAsset], app.assets).load(resolve);
    });

    const bicycle = new pc.Entity('bicycle');
    bicycle.addComponent('gsplat', { asset: bicycleAsset, unified: true });
    bicycle.setLocalEulerAngles(0, 0, 180);
    bicycle.setLocalScale(2, 2, 2);
    app.root.addChild(bicycle);

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

    const church = new pc.Entity('church');
    church.addComponent('gsplat', { asset: churchAsset, unified: true });
    church.setLocalEulerAngles(-90, 0, 0);
    app.root.addChild(church);

    const cameraPivot = new pc.Entity('cameraPivot');
    cameraPivot.setLocalPosition(0, 1.2, 0);
    app.root.addChild(cameraPivot);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1),
        fov: 60
    });
    camera.setLocalPosition(-4, 0, 0);
    camera.lookAt(new pc.Vec3(0, 0, 0));
    cameraPivot.addChild(camera);

    app.start();

    let rotateCamera = false;
    app.on('update', () => {
        if (rotateCamera) {
            cameraPivot.rotateLocal(0, 0.5, 0);
        }
    });

    const gsplatSystem = /** @type {any} */ (app.systems.gsplat);
    const startAngle = -(WARMUP_FRAMES + MEASURE_FRAMES / 2) * 0.5;

    // Ensure storedResults[colIndex] exists with the right structure
    if (!storedResults[colIndex]) {
        storedResults[colIndex] = {
            label: config.label,
            deviceType: config.device,
            gpuInfo,
            computePerfIndex,
            budgetResults: new Array(BUDGETS.length).fill(null)
        };
    }
    const stored = /** @type {any} */ (storedResults[colIndex]);
    stored.gpuInfo = gpuInfo;
    if (computePerfIndex >= 0) stored.computePerfIndex = computePerfIndex;

    for (const bi of budgetIndices) {
        const millions = BUDGETS[bi];
        app.scene.gsplat.splatBudget = millions * 1000000;

        rotateCamera = false;
        cameraPivot.setLocalEulerAngles(0, startAngle, 0);

        await waitForReady(gsplatSystem, app, `${config.label} [${millions}M]`); // eslint-disable-line no-await-in-loop

        rotateCamera = true;

        const result = await measureFrames(app, device, config.label, `${millions}M`); // eslint-disable-line no-await-in-loop
        stored.budgetResults[bi] = {
            budget: millions,
            avgCpu: result.avgCpu,
            avgGpu: result.avgGpu,
            avgSplats: result.avgSplats,
            avgPassTimings: result.avgPassTimings
        };

        const val = result.avgGpu >= 0 ? result.avgGpu : result.avgCpu;
        setCell(`${millions}M:${colIndex}`, val.toFixed(2), '#fff');
    }

    if (computePerfIndex >= 0) storedComputePerfIndex = computePerfIndex;
    if (!storedGpuInfos[config.device]) storedGpuInfos[config.device] = gpuInfo;

    window.removeEventListener('resize', resize);
    app.destroy();
    canvas.remove();
}

// ── Chart + download ──

/**
 * @param {number} v - Value.
 * @returns {string} Formatted.
 */
function fmt(v) {
    return v >= 0 ? v.toFixed(2) : '\u2014';
}

function refreshChartAndDownload() {
    chartArea.innerHTML = '';

    const anyResults = storedResults.some(r => r !== null);
    if (!anyResults) return;

    const chartCanvas = document.createElement('canvas');
    chartCanvas.width = 778;
    chartCanvas.height = 389;
    Object.assign(chartCanvas.style, {
        display: 'block',
        background: '#1a1a2e',
        borderRadius: '4px',
        width: '100%',
        maxWidth: '770px',
        marginBottom: '12px'
    });
    chartArea.appendChild(chartCanvas);
    drawChart(chartCanvas);

    const dlText = buildDownloadText();

    const dlBtn = document.createElement('button');
    dlBtn.textContent = 'Download Results';
    Object.assign(dlBtn.style, {
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
    chartArea.appendChild(dlBtn);

    console.log(dlText);
}

/**
 * @returns {string} Download text.
 */
function buildDownloadText() {
    const COL_W = 10;
    const budgetHeader = BUDGETS.map(b => `${b}M`.padStart(COL_W)).join('');
    const lineW = 24 + BUDGETS.length * COL_W;

    let text = 'GSplat Benchmark Results\n';
    text += `${'\u2550'.repeat(lineW)}\n`;
    if (storedGpuInfos.webgl2) text += `WebGL2:  ${storedGpuInfos.webgl2}\n`;
    if (storedGpuInfos.webgpu) text += `WebGPU:  ${storedGpuInfos.webgpu}\n`;
    text += `Compute Perf Index: ${storedComputePerfIndex >= 0 ? storedComputePerfIndex.toFixed(3) : '\u2014'} ms\n`;
    text += `${'\u2550'.repeat(lineW)}\n`;

    // Find first column with at least one budget result for splat count line
    let firstValid = null;
    for (const r of storedResults) {
        if (!r) continue;
        const br = /** @type {any} */ (r).budgetResults;
        if (br && br.some((/** @type {any} */ x) => x !== null)) {
            firstValid = r;
            break;
        }
    }
    if (firstValid) {
        const br = /** @type {any} */ (firstValid).budgetResults;
        let splatLine = 'GSplat Count (M)'.padEnd(22);
        for (let i = 0; i < BUDGETS.length; i++) {
            splatLine += br[i] ? (br[i].avgSplats / 1000000).toFixed(1).padStart(COL_W) : '\u2014'.padStart(COL_W);
        }
        text += `\n${splatLine}\n`;
    }

    for (const metric of ['CPU', 'GPU']) {
        text += `\n${metric} Frame Time (ms)\n`;
        text += `${'Renderer'.padEnd(22)} ${budgetHeader}\n`;
        text += `${'\u2500'.repeat(lineW)}\n`;
        for (let c = 0; c < RENDERERS.length; c++) {
            const r = storedResults[c];
            if (!r) continue;
            const sr = /** @type {any} */ (r);
            let line = sr.label.padEnd(22);
            for (let i = 0; i < BUDGETS.length; i++) {
                const entry = sr.budgetResults[i];
                if (!entry) {
                    line += '\u2014'.padStart(COL_W);
                    continue;
                }
                const v = metric === 'CPU' ? entry.avgCpu : entry.avgGpu;
                line += fmt(v).padStart(COL_W);
            }
            text += `${line}\n`;
        }
    }
    text += `${'\u2500'.repeat(lineW)}\n`;

    text += `\n\n${'='.repeat(60)}\n`;
    text += 'Per-Pass GPU Timings (WebGPU runs)\n';
    text += `${'='.repeat(60)}\n`;
    for (let c = 0; c < RENDERERS.length; c++) {
        const r = storedResults[c];
        if (!r) continue;
        const sr = /** @type {any} */ (r);
        if (sr.deviceType !== 'webgpu') continue;
        for (let i = 0; i < BUDGETS.length; i++) {
            const entry = sr.budgetResults[i];
            if (!entry || !entry.avgPassTimings || entry.avgPassTimings.size === 0) continue;
            text += `\n--- ${sr.label} @ ${entry.budget}M ---\n`;
            const sorted = [...entry.avgPassTimings.entries()].sort((a, b) => b[1] - a[1]);
            for (const [name, time] of sorted) {
                text += `  ${name.padEnd(45)} ${time.toFixed(3)} ms\n`;
            }
        }
    }

    text += `\nConfig: ${WARMUP_FRAMES} warmup + ${MEASURE_FRAMES} measured frames per budget level\n`;
    text += `Budgets: ${BUDGETS.map(b => `${b}M`).join(', ')}\n`;
    text += `UserAgent: ${navigator.userAgent}\n`;
    text += `Date: ${new Date().toISOString()}\n`;
    return text;
}

/**
 * @param {HTMLCanvasElement} chartCanvas - Canvas element.
 */
function drawChart(chartCanvas) {
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;

    const W = chartCanvas.width;
    const H = chartCanvas.height;
    const PAD = { top: 30, right: 20, bottom: 40, left: 50 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f'];

    let maxVal = 0;
    for (let c = 0; c < RENDERERS.length; c++) {
        const r = storedResults[c];
        if (!r) continue;
        const br = /** @type {any} */ (r).budgetResults;
        for (let i = 0; i < BUDGETS.length; i++) {
            if (!br[i]) continue;
            const v = br[i].avgGpu >= 0 ? br[i].avgGpu : br[i].avgCpu;
            if (v > maxVal) maxVal = v;
        }
    }
    maxVal = Math.ceil(maxVal * 1.15);
    if (maxVal === 0) maxVal = 1;

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, H - PAD.bottom);
    ctx.lineTo(W - PAD.right, H - PAD.bottom);
    ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const v = (maxVal / yTicks) * i;
        const y = H - PAD.bottom - (i / yTicks) * plotH;
        ctx.fillText(v.toFixed(1), PAD.left - 5, y + 4);
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    for (let i = 0; i < BUDGETS.length; i++) {
        const x = PAD.left + (i / (BUDGETS.length - 1)) * plotW;
        ctx.fillText(`${BUDGETS[i]}M`, x, H - PAD.bottom + 18);
    }

    ctx.fillStyle = '#ccc';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GPU Frame Time (ms) vs Splat Budget', W / 2, 18);

    for (let c = 0; c < RENDERERS.length; c++) {
        const r = storedResults[c];
        if (!r) continue;
        const br = /** @type {any} */ (r).budgetResults;

        const color = COLORS[c % COLORS.length];
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        /** @type {{x: number, y: number}[]} */
        const points = [];
        for (let i = 0; i < BUDGETS.length; i++) {
            if (!br[i]) continue;
            const v = br[i].avgGpu >= 0 ? br[i].avgGpu : br[i].avgCpu;
            const x = PAD.left + (i / (BUDGETS.length - 1)) * plotW;
            const y = H - PAD.bottom - (v / maxVal) * plotH;
            points.push({ x, y });
        }

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
        }

        for (const pt of points) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Legend
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    for (let c = 0; c < RENDERERS.length; c++) {
        const color = COLORS[c % COLORS.length];
        const lx = PAD.left + 10;
        const ly = PAD.top + 10 + c * 14;
        ctx.fillStyle = storedResults[c] ? color : '#444';
        ctx.fillRect(lx, ly - 4, 10, 3);
        ctx.fillText(RENDERERS[c].label, lx + 14, ly);
    }
}

function updateGpuInfo() {
    let text = '';
    if (storedGpuInfos.webgl2) text += `WebGL2: ${storedGpuInfos.webgl2}\n`;
    if (storedGpuInfos.webgpu) text += `WebGPU: ${storedGpuInfos.webgpu}\n`;
    if (storedComputePerfIndex >= 0) text += `Compute Perf Index: ${storedComputePerfIndex.toFixed(3)} ms`;
    gpuInfoEl.textContent = text;
}

// ── Run logic ──

/**
 * @param {number} colIndex - Column to run.
 * @param {number[]} budgetIndices - Budget indices to run.
 */
async function runTests(colIndex, budgetIndices) {
    try {
        await runBenchmark(RENDERERS[colIndex], colIndex, budgetIndices);
    } catch (e) {
        console.error(`Benchmark failed for ${RENDERERS[colIndex].label}:`, e);
        for (const bi of budgetIndices) {
            setCell(`${BUDGETS[bi]}M:${colIndex}`, 'FAIL', '#ff6b6b');
        }
    }
    updateGpuInfo();
    refreshChartAndDownload();
}

/**
 * @param {number} colIndex - Column to run (all budgets).
 */
async function runColumn(colIndex) {
    if (running) return;
    running = true;
    setButtonsEnabled(false);
    setTestingMode(true);

    const indices = BUDGETS.map((_, i) => i);
    await runTests(colIndex, indices);

    setTestingMode(false);
    setStatus('');
    running = false; // eslint-disable-line require-atomic-updates
    setButtonsEnabled(true);
}

/**
 * @param {number} budgetIndex - Budget row to run (all renderers).
 */
async function runRow(budgetIndex) {
    if (running) return;
    running = true;
    setButtonsEnabled(false);
    setTestingMode(true);

    for (let c = 0; c < RENDERERS.length; c++) {
        await runTests(c, [budgetIndex]); // eslint-disable-line no-await-in-loop
    }

    setTestingMode(false);
    setStatus('');
    running = false;
    setButtonsEnabled(true);
}

/**
 * @param {number} colIndex - Column.
 * @param {number} budgetIndex - Budget row.
 */
async function runCell(colIndex, budgetIndex) {
    if (running) return;
    running = true;
    setButtonsEnabled(false);
    setTestingMode(true);

    await runTests(colIndex, [budgetIndex]);

    setTestingMode(false);
    setStatus('');
    running = false; // eslint-disable-line require-atomic-updates
    setButtonsEnabled(true);
}

async function runAll() {
    if (running) return;
    running = true;
    setButtonsEnabled(false);
    setTestingMode(true);

    const allIndices = BUDGETS.map((_, i) => i);
    for (let c = 0; c < RENDERERS.length; c++) {
        await runTests(c, allIndices); // eslint-disable-line no-await-in-loop
    }

    setTestingMode(false);
    setStatus('');
    running = false;
    setButtonsEnabled(true);
}

runAllBtn.onclick = runAll;

const destroy = () => {
    containerEl.remove();
    floatingStatus.remove();
};

export { destroy };
