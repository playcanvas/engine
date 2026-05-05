// @config NO_MINISTATS
// @config NO_DEVICE_SELECTOR
// @config WEBGPU_DISABLED
// @config WEBGL_DISABLED
// @config DESCRIPTION Benchmarks GSplat rendering across WebGL2 and WebGPU with different renderer modes and splat counts.
import { rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const WARMUP_FRAMES = 10;
const MEASURE_FRAMES = 60;

/** World dolly along camera.right (direction locked on first measure frame after yaw). Yaw+dolly only during measure frames; warmup is static. Fixed step/frame (no dt). */
const CAMERA_SIDE_TRANSLATE_UNITS = 12;

/** Lateral delta each measure frame (warmup: yaw only). */
const CAMERA_SIDE_STEP = MEASURE_FRAMES > 0 ? CAMERA_SIDE_TRANSLATE_UNITS / MEASURE_FRAMES : CAMERA_SIDE_TRANSLATE_UNITS;

/** Camera pivot rest position (world == local under root). */
const benchPivotBasePos = new pc.Vec3(10.3, 2, -10);

/** Wall-clock duration for idle rAF sampling before any benchmark run (reference FPS). */
const IDLE_FPS_SAMPLE_MS = 1000;

const RENDERER_RASTER_CPU_SORT = 1;
const RENDERER_RASTER_GPU_SORT = 2;
const RENDERER_COMPUTE = 3;
const RENDERER_RASTER_HYBRID = 4;

const RENDERERS = [
    { device: 'webgl2', renderer: RENDERER_RASTER_CPU_SORT, label: 'WebGL2 CPU Sort', shortLabel: 'GL2 CPU' },
    { device: 'webgpu', renderer: RENDERER_RASTER_CPU_SORT, label: 'WebGPU CPU Sort', shortLabel: 'GPU CPU' },
    { device: 'webgpu', renderer: RENDERER_RASTER_GPU_SORT, label: 'WebGPU GPU Sort', shortLabel: 'GPU Sort' },
    { device: 'webgpu', renderer: RENDERER_COMPUTE, label: 'WebGPU Compute', shortLabel: 'Compute' },
    { device: 'webgpu', renderer: RENDERER_RASTER_HYBRID, label: 'WebGPU Hybrid', shortLabel: 'Hybrid' }
];

const BUDGETS = [1, 2, 3, 4, 6, 8, 10, 15, 20, 25, 30, 35]; // millions

/** Design-time chart dimensions (CSS px); bitmap scales with table width × DPR. */
const CHART_REF_W = 778;
const CHART_REF_H = 389;

// ── Stored results per renderer column ──
// storedResults[col].budgetResults is length BUDGETS.length, entries are null or result object

/** @type {(object|null)[]} */
const storedResults = new Array(RENDERERS.length).fill(null);
/** @type {Record<string, string>} */
const storedGpuInfos = {};
let storedResolution = '';
let highRes = false;
let running = false;

/** @type {number|null} Measured idle scheduling FPS from rAF (~1s sample). */
let idleRefFps = null;
/** @type {number} Active rAF id during idle probe; cleared when done or on destroy. */
let idleProbeRafId = 0;
/** @type {number} Debounced resize timer id. */
let uiResizeTimer = 0;

/** True after a WebGL2 benchmark run on a context without disjoint timer queries (GPU ms N/A). */
let webglGpuProfilingUnavailable = false;

/**
 * Same maxPixelRatio rule as runBenchmark (High Res vs automatic DPR scaling).
 *
 * @returns {number} Effective max pixel ratio for the next benchmark run.
 */
function getBenchmarkMaxPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    return highRes ? Math.min(dpr, 2) : (dpr >= 2 ? dpr * 0.5 : dpr);
}

/**
 * Estimated backing-store size for the fullscreen benchmark canvas on the next run.
 *
 * @returns {{ w: number, h: number, maxPR: number, dpr: number }} Rounded pixel size and ratio metadata.
 */
function getExpectedBenchmarkCanvasPixels() {
    const dpr = window.devicePixelRatio || 1;
    const maxPR = getBenchmarkMaxPixelRatio();
    const w = Math.max(1, Math.floor(window.innerWidth * maxPR));
    const h = Math.max(1, Math.floor(window.innerHeight * maxPR));
    return { w, h, maxPR, dpr };
}

/**
 * @param {number} avgGpu - Mean GPU ms or -1 if unavailable.
 * @returns {string} Display text for the GPU milliseconds cell (or N/A).
 */
function formatGpuMsCell(avgGpu) {
    return avgGpu >= 0 ? avgGpu.toFixed(2) : 'N/A';
}

/**
 * @param {number} effectiveFps - Effective FPS from wall clock.
 * @returns {string} Display text for effective FPS (or em dash if invalid).
 */
function formatEffectiveFpsCell(effectiveFps) {
    return effectiveFps > 0 ? effectiveFps.toFixed(1) : '\u2014';
}

// ── UI ──

// Override main.css which sets touch-action:none on * and overflow:hidden on body
const overrideStyle = document.createElement('style');
overrideStyle.textContent = '*, *::before, *::after { touch-action: auto !important; } html, body { overflow: auto !important; height: auto !important; }';
document.head.appendChild(overrideStyle);

const appEl = document.getElementById('app');
if (appEl) appEl.style.display = 'none';

const containerEl = document.createElement('div');
Object.assign(containerEl.style, {
    position: 'relative',
    zIndex: '100',
    color: '#fff',
    background: '#111',
    fontFamily: 'monospace',
    fontSize: '13px',
    padding: '20px',
    paddingTop: '10vh',
    boxSizing: 'border-box',
    minHeight: '100vh'
});
document.body.appendChild(containerEl);

const styleEl = document.createElement('style');
styleEl.textContent = '.bench-cell { background: #1a1a2e; border-radius: 3px; transition: background 0.15s; } .bench-cell:hover { background: #2a2a4e; }';
document.head.appendChild(styleEl);

const titleEl = document.createElement('h2');
titleEl.textContent = 'PlayCanvas GSplat Benchmark';
Object.assign(titleEl.style, { margin: '0 0 4px 0', fontSize: '20px', fontWeight: 'normal' });
containerEl.appendChild(titleEl);

const benchWarnEl = document.createElement('div');
Object.assign(benchWarnEl.style, {
    display: 'none',
    marginBottom: '10px',
    padding: '8px 10px',
    background: '#2a2218',
    border: '1px solid #664',
    borderRadius: '4px',
    color: '#ffb347',
    fontSize: '12px',
    lineHeight: '1.45',
    maxWidth: '900px',
    whiteSpace: 'pre-wrap'
});
containerEl.appendChild(benchWarnEl);

function syncBenchBanner() {
    if (!webglGpuProfilingUnavailable) {
        benchWarnEl.style.display = 'none';
        benchWarnEl.textContent = '';
        return;
    }
    benchWarnEl.style.display = 'block';
    benchWarnEl.textContent =
        'GPU timings unavailable: WebGL on this device does not support EXT_disjoint_timer_query. ' +
        'WebGL GPU table shows N/A for GPU milliseconds; Effective FPS is still measured.';
}

const gpuInfoEl = document.createElement('div');
Object.assign(gpuInfoEl.style, { marginBottom: '8px', color: '#888', fontSize: '12px', whiteSpace: 'pre' });
containerEl.appendChild(gpuInfoEl);

const benchmarkLegendEl = document.createElement('div');
benchmarkLegendEl.textContent = [
    'Controls:',
    'Run All — all renderer columns and all budget rows.',
    'Column headers (GL2 CPU, …) — that renderer only, all budgets.',
    `Left column (e.g. ${BUDGETS[0]}M \u2191) — every budget from ${BUDGETS[0]}M up through that row, all renderers.`,
    'Right column (e.g. \u2190 10M) — only that budget, all renderers (no smaller budgets).',
    'Grid cells — that renderer only, cumulative budgets up through that row.',
    '',
    'Layout: GPU ms grid + chart (top row), Effective FPS grid + chart (bottom row). Bottom grid mirrors the top; use controls on the GPU table.',
    `GPU ms — mean GPU profiler time over ${MEASURE_FRAMES} measured frames (N/A if unsupported or any frame lacked a GPU sample).`,
    `Effective FPS — ${MEASURE_FRAMES} divided by wall-clock seconds across those same frames (scheduling + GPU + stalls).`
].join('\n');
Object.assign(benchmarkLegendEl.style, {
    marginBottom: '12px',
    color: '#aaa',
    fontSize: '11px',
    lineHeight: '1.45',
    whiteSpace: 'pre-wrap',
    maxWidth: '900px'
});
containerEl.appendChild(benchmarkLegendEl);

// High Res toggle
const highResLabel = document.createElement('label');
Object.assign(highResLabel.style, { display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#aaa', fontSize: '13px', cursor: 'pointer' });
const highResCheckbox = document.createElement('input');
highResCheckbox.type = 'checkbox';
highResCheckbox.checked = highRes;
highResCheckbox.onchange = () => {
    highRes = highResCheckbox.checked;
    updateGpuInfo();
};
highResLabel.appendChild(highResCheckbox);
highResLabel.appendChild(document.createTextNode('High Resolution'));
containerEl.appendChild(highResLabel);
containerEl.appendChild(document.createElement('br'));

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

const compactBtnCss = headerBtnCss.replace('padding: 6px 14px', 'padding: 3px 6px').replace('font-size: 14px', 'font-size: 11px');
const compactRowOnlyBtnCss = compactBtnCss.replace('#4a9eff', '#2fa36b');
const compactRunAllBtnCss = compactBtnCss.replace('#4a9eff', '#e05555');

const narrowCellBase = 'padding: 4px 5px; border: 1px solid #333; text-align: center; white-space: nowrap; background: #222; color: #fff;';
/** Same width for Run All / budget column (left) and Only column (right). */
const COL_EDGE_W = Math.round(58 * 1.3);
const narrowEdgeColCss = `${narrowCellBase} box-sizing: border-box; width: ${COL_EDGE_W}px; min-width: ${COL_EDGE_W}px; max-width: ${COL_EDGE_W}px;`;

/** Renderer grid columns (~30% wider than prior 84px so values don’t clip). */
const RENDERER_COL_W = Math.round(84 * 1.3);
const rendererCellCss = `padding: 10px 6px; border: 1px solid #333; text-align: center; box-sizing: border-box; width: ${RENDERER_COL_W}px; min-width: ${RENDERER_COL_W}px; max-width: ${RENDERER_COL_W}px;`;
const rendererHeaderCellCss = `${rendererCellCss} background: #222; color: #fff;`;

const cellPad = rendererCellCss;
const headerCellCss = rendererHeaderCellCss;

/** @type {HTMLButtonElement[]} */
const allBtns = [];

/**
 * One benchmark results table (same shape). Interactive table registers Run / row / column controls.
 *
 * @param {boolean} interactive - True for the GPU table only.
 * @returns {{ table: HTMLTableElement, cellEls: Map<string, HTMLTableCellElement> }} Table and map of result cells.
 */
function createBenchTable(interactive) {
    const tbl = document.createElement('table');
    Object.assign(tbl.style, {
        borderCollapse: 'collapse',
        marginBottom: '0',
        fontSize: '15px',
        width: 'max-content',
        tableLayout: 'fixed'
    });

    const cg = document.createElement('colgroup');
    const cc = document.createElement('col');
    cc.style.width = `${COL_EDGE_W}px`;
    cg.appendChild(cc);
    for (let i = 0; i < RENDERERS.length; i++) {
        const col = document.createElement('col');
        col.style.width = `${RENDERER_COL_W}px`;
        cg.appendChild(col);
    }
    const co = document.createElement('col');
    co.style.width = `${COL_EDGE_W}px`;
    cg.appendChild(co);
    tbl.appendChild(cg);

    const thead = document.createElement('thead');
    const headTr = document.createElement('tr');

    const cornerTh = document.createElement('th');
    cornerTh.style.cssText = narrowEdgeColCss;
    if (interactive) {
        const runAllBtn = document.createElement('button');
        runAllBtn.textContent = 'Run All';
        runAllBtn.style.cssText = compactRunAllBtnCss;
        cornerTh.appendChild(runAllBtn);
        allBtns.push(runAllBtn);
    } else {
        cornerTh.textContent = '\u2014';
    }
    headTr.appendChild(cornerTh);

    for (let c = 0; c < RENDERERS.length; c++) {
        const th = document.createElement('th');
        th.style.cssText = headerCellCss;
        if (interactive) {
            const btn = document.createElement('button');
            btn.textContent = RENDERERS[c].shortLabel;
            btn.style.cssText = headerBtnCss;
            btn.onclick = () => runColumn(c);
            th.appendChild(btn);
            allBtns.push(btn);
        } else {
            th.textContent = RENDERERS[c].shortLabel;
        }
        headTr.appendChild(th);
    }

    const onlyHeaderTh = document.createElement('th');
    onlyHeaderTh.style.cssText = narrowEdgeColCss;
    onlyHeaderTh.textContent = interactive ? 'Only' : '';
    headTr.appendChild(onlyHeaderTh);

    thead.appendChild(headTr);
    tbl.appendChild(thead);

    const tbody = document.createElement('tbody');
    /** @type {Map<string, HTMLTableCellElement>} */
    const cellMap = new Map();

    for (let b = 0; b < BUDGETS.length; b++) {
        const tr = document.createElement('tr');
        const firstTd = document.createElement('td');
        firstTd.style.cssText = narrowEdgeColCss;
        if (interactive) {
            const rowBtn = document.createElement('button');
            rowBtn.textContent = `${BUDGETS[b]}M \u2191`;
            rowBtn.style.cssText = compactBtnCss;
            rowBtn.onclick = () => runRow(b);
            firstTd.appendChild(rowBtn);
            allBtns.push(rowBtn);
        } else {
            firstTd.textContent = `${BUDGETS[b]}M`;
        }
        tr.appendChild(firstTd);

        for (let c = 0; c < RENDERERS.length; c++) {
            const td = document.createElement('td');
            td.style.cssText = `${cellPad} color: #555;`;
            td.className = 'bench-cell';
            td.textContent = '\u2014';
            if (interactive) {
                td.style.cursor = 'pointer';
                td.onclick = () => runCell(c, b);
            } else {
                td.style.cursor = 'default';
            }
            tr.appendChild(td);
            cellMap.set(`${BUDGETS[b]}M:${c}`, td);
        }

        const onlyTd = document.createElement('td');
        onlyTd.style.cssText = narrowEdgeColCss;
        if (interactive) {
            const onlyBtn = document.createElement('button');
            onlyBtn.textContent = `\u2190 ${BUDGETS[b]}M`;
            onlyBtn.style.cssText = compactRowOnlyBtnCss;
            onlyBtn.onclick = () => runRowOnly(b);
            onlyTd.appendChild(onlyBtn);
            allBtns.push(onlyBtn);
        }
        tr.appendChild(onlyTd);

        tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);

    return { table: tbl, cellEls: cellMap };
}

const { table: tableGpu, cellEls: cellElsGpu } = createBenchTable(true);
const { table: tableFps, cellEls: cellElsFps } = createBenchTable(false);

/**
 * @param {string} label - Section heading.
 * @returns {HTMLDivElement} Small heading above a benchmark table.
 */
function benchSectionLabel(label) {
    const el = document.createElement('div');
    el.textContent = label;
    Object.assign(el.style, {
        fontSize: '12px',
        color: '#888',
        marginBottom: '5px',
        fontWeight: 'normal'
    });
    return el;
}

const benchMainGrid = document.createElement('div');
Object.assign(benchMainGrid.style, {
    display: 'grid',
    gridTemplateColumns: 'max-content max-content',
    columnGap: '16px',
    rowGap: '14px',
    alignItems: 'start',
    justifyItems: 'start',
    width: 'max-content',
    maxWidth: '100%',
    boxSizing: 'border-box'
});

const gpuTableSection = document.createElement('div');
gpuTableSection.appendChild(benchSectionLabel('GPU frame time (ms)'));
gpuTableSection.appendChild(tableGpu);

const gpuChartWrap = document.createElement('div');
Object.assign(gpuChartWrap.style, { minWidth: '0' });

const fpsTableSection = document.createElement('div');
fpsTableSection.appendChild(benchSectionLabel(`Effective FPS (${MEASURE_FRAMES} frames / wall clock)`));
fpsTableSection.appendChild(tableFps);

const fpsChartWrap = document.createElement('div');
Object.assign(fpsChartWrap.style, { minWidth: '0' });

const chartActionsRow = document.createElement('div');
Object.assign(chartActionsRow.style, {
    gridColumn: '1 / -1',
    marginTop: '2px'
});

benchMainGrid.appendChild(gpuTableSection);
benchMainGrid.appendChild(gpuChartWrap);
benchMainGrid.appendChild(fpsTableSection);
benchMainGrid.appendChild(fpsChartWrap);
benchMainGrid.appendChild(chartActionsRow);

const benchScrollBlock = document.createElement('div');
Object.assign(benchScrollBlock.style, {
    display: 'inline-block',
    width: 'max-content',
    maxWidth: '100%',
    boxSizing: 'border-box',
    verticalAlign: 'top'
});
benchScrollBlock.appendChild(benchMainGrid);

const statusEl = document.createElement('div');
Object.assign(statusEl.style, {
    marginBottom: '12px',
    marginTop: '8px',
    color: '#aaa',
    whiteSpace: 'pre',
    lineHeight: '1.4',
    minHeight: '1.4em',
    fontSize: '14px'
});
benchScrollBlock.appendChild(statusEl);

const floatingStatus = document.createElement('div');
Object.assign(floatingStatus.style, {
    position: 'fixed',
    top: '10%',
    left: '10px',
    zIndex: '300',
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

containerEl.appendChild(benchScrollBlock);

window.addEventListener('resize', () => {
    window.clearTimeout(uiResizeTimer);
    uiResizeTimer = window.setTimeout(() => {
        updateGpuInfo();
        if (!storedResults.some(r => r !== null)) return;
        refreshChartAndDownload();
    }, 200);
});

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
 * @param {string} gpuText - GPU table cell text.
 * @param {string} fpsText - Effective FPS table cell text.
 * @param {string} [color] - Text color for both cells.
 */
function setBenchCells(key, gpuText, fpsText, color) {
    const col = color || '#fff';
    const g = cellElsGpu.get(key);
    const f = cellElsFps.get(key);
    if (g) {
        g.textContent = gpuText;
        g.style.color = col;
    }
    if (f) {
        f.textContent = fpsText;
        f.style.color = col;
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
    for (const [, td] of cellElsGpu) {
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
    const opts = { antialias: false };
    if (deviceType === 'webgpu') {
        const device = new pc.WebgpuGraphicsDevice(canvas, opts);
        await device.initWebGpu(
            `${rootPath}/static/lib/glslang/glslang.js`,
            `${rootPath}/static/lib/twgsl/twgsl.js`
        );
        return device;
    }
    return new pc.WebglGraphicsDevice(canvas, opts);
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
 * @param {boolean} gpuTimingSupported - False disables GPU timer collection (WebGL without disjoint timer query).
 * @returns {Promise<{avgGpu: number, effectiveFps: number, avgSplats: number, avgPassTimings: Map<string, number>}>} Results.
 */
function measureFrames(app, device, label, budgetLabel, gpuTimingSupported) {
    return new Promise((resolve) => {
        const gpuTimes = [];
        const splatCounts = [];
        /** @type {Map<string, number[]>} */
        const passAccum = new Map();
        let frame = 0;
        /** @type {number|null} */
        let wallStart = null;

        const onFrame = () => {
            frame++;
            if (frame <= WARMUP_FRAMES) {
                setStatus(`${label} [${budgetLabel}]  Warming up ${frame}/${WARMUP_FRAMES}`);
                return;
            }
            const idx = frame - WARMUP_FRAMES;
            if (idx === 1) {
                wallStart = performance.now();
            }
            setStatus(`${label} [${budgetLabel}]  Measuring ${idx}/${MEASURE_FRAMES}`);

            splatCounts.push(app.stats.frame.gsplats);

            if (gpuTimingSupported && device.gpuProfiler) {
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
                const wallEnd = performance.now();
                const wallSec = wallStart !== null ? Math.max(1e-9, (wallEnd - wallStart) / 1000) : 1e-9;
                const effectiveFps = MEASURE_FRAMES / wallSec;
                const avgGpu = gpuTimingSupported && gpuTimes.length === MEASURE_FRAMES ?
                    gpuTimes.reduce((a, b) => a + b, 0) / MEASURE_FRAMES : -1;
                const avgSplats = splatCounts.reduce((a, b) => a + b, 0) / splatCounts.length;
                /** @type {Map<string, number>} */
                const avgPass = new Map();
                for (const [name, times] of passAccum) {
                    avgPass.set(name, times.reduce((a, b) => a + b, 0) / times.length);
                }
                resolve({ avgGpu, effectiveFps, avgSplats, avgPassTimings: avgPass });
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
        setBenchCells(`${BUDGETS[bi]}M:${colIndex}`, '...', '...', '#666');
    }

    const canvas = document.createElement('canvas');
    canvas.id = `bench-${Date.now()}`;
    Object.assign(canvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '200'
    });
    document.body.appendChild(canvas);

    const device = await createDevice(canvas, config.device);
    const dpr = window.devicePixelRatio || 1;
    device.maxPixelRatio = highRes ? Math.min(dpr, 2) : (dpr >= 2 ? dpr * 0.5 : dpr);
    const gpuInfo = getGpuInfo(device);

    const extDisjointTimerQuery = /** @type {any} */ (device).extDisjointTimerQuery;
    const gpuTimingSupported = config.device !== 'webgl2' || !!extDisjointTimerQuery;
    if (config.device === 'webgl2') {
        webglGpuProfilingUnavailable = !gpuTimingSupported;
        syncBenchBanner();
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
    app.scene.gsplat.lodBehindPenalty = 3;
    app.scene.gsplat.radialSorting = true;

    if (device.gpuProfiler && gpuTimingSupported) {
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
    bicycle.setLocalPosition(11.2, 0, -3.5);
    bicycle.setLocalEulerAngles(0, 90, 180);
    bicycle.setLocalScale(2, 2, 2);
    app.root.addChild(bicycle);

    const logo = new pc.Entity('logo');
    logo.addComponent('gsplat', { asset: logoAsset, unified: true });
    logo.setLocalPosition(8, 0, 2.6);
    logo.setLocalEulerAngles(180, 0, 0);
    logo.setLocalScale(2, 2, 2);
    app.root.addChild(logo);

    const church = new pc.Entity('church');
    church.addComponent('gsplat', { asset: churchAsset, unified: true });
    church.setLocalEulerAngles(-90, 0, 0);
    app.root.addChild(church);

    const cameraPivot = new pc.Entity('cameraPivot');
    cameraPivot.setLocalPosition(benchPivotBasePos.x, benchPivotBasePos.y, benchPivotBasePos.z);
    app.root.addChild(cameraPivot);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1),
        fov: 75
    });
    cameraPivot.addChild(camera);
    camera.lookAt(new pc.Vec3(12, 3, 0));

    app.start();
    app.resizeCanvas();

    storedResolution = `${device.width} x ${device.height}`;

    let rotateCamera = false;
    let benchMotionFrame = 0;
    let benchLateralAccum = 0;
    let benchLateralCaptured = false;
    const benchLateralDir = new pc.Vec3();

    /**
     * Warmup (measureFrames): camera frozen. Measure phase: yaw + lateral together each frameend (fixed steps, no dt).
     */
    const onBenchCameraMotion = () => {
        if (!rotateCamera) {
            return;
        }
        benchMotionFrame++;

        const measureIdx = benchMotionFrame - WARMUP_FRAMES;
        if (measureIdx < 1 || measureIdx > MEASURE_FRAMES) {
            return;
        }

        cameraPivot.rotateLocal(0, 1.0, 0);

        if (measureIdx === 1) {
            benchLateralDir.copy(camera.right);
            benchLateralDir.normalize();
            benchLateralCaptured = true;
        }

        if (benchLateralCaptured) {
            benchLateralAccum += CAMERA_SIDE_STEP;
            cameraPivot.setLocalPosition(
                benchPivotBasePos.x + benchLateralDir.x * benchLateralAccum,
                benchPivotBasePos.y + benchLateralDir.y * benchLateralAccum,
                benchPivotBasePos.z + benchLateralDir.z * benchLateralAccum
            );
        }
    };
    app.on('frameend', onBenchCameraMotion);

    const gsplatSystem = /** @type {any} */ (app.systems.gsplat);
    /** Initial yaw so measure-phase orbit stays centered now that warmup does not rotate. */
    const startAngle = -(MEASURE_FRAMES / 2) * 0.5;

    // Ensure storedResults[colIndex] exists with the right structure
    if (!storedResults[colIndex]) {
        storedResults[colIndex] = {
            label: config.label,
            deviceType: config.device,
            gpuInfo,
            gpuTimingSupported,
            budgetResults: new Array(BUDGETS.length).fill(null)
        };
    }
    const stored = /** @type {any} */ (storedResults[colIndex]);
    stored.gpuInfo = gpuInfo;
    stored.gpuTimingSupported = gpuTimingSupported;

    for (const bi of budgetIndices) {
        const millions = BUDGETS[bi];
        app.scene.gsplat.splatBudget = millions * 1000000;

        rotateCamera = false;
        cameraPivot.setLocalEulerAngles(0, startAngle, 0);
        cameraPivot.setLocalPosition(benchPivotBasePos.x, benchPivotBasePos.y, benchPivotBasePos.z);
        camera.setLocalPosition(0, 0, 0);
        benchMotionFrame = 0;
        benchLateralAccum = 0;
        benchLateralCaptured = false;

        await waitForReady(gsplatSystem, app, `${config.label} [${millions}M]`); // eslint-disable-line no-await-in-loop

        rotateCamera = true;

        const result = await measureFrames(app, device, config.label, `${millions}M`, gpuTimingSupported); // eslint-disable-line no-await-in-loop
        rotateCamera = false;

        stored.budgetResults[bi] = {
            budget: millions,
            avgGpu: result.avgGpu,
            effectiveFps: result.effectiveFps,
            avgSplats: result.avgSplats,
            avgPassTimings: result.avgPassTimings
        };

        setBenchCells(`${millions}M:${colIndex}`, formatGpuMsCell(result.avgGpu), formatEffectiveFpsCell(result.effectiveFps), '#fff');
    }

    if (!storedGpuInfos[config.device]) storedGpuInfos[config.device] = gpuInfo;

    window.removeEventListener('resize', resize);
    app.off('frameend', onBenchCameraMotion);
    app.destroy();
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();

    // allow GC to reclaim GPU/asset memory before the next run (helps on mobile)
    await new Promise((resolve) => {
        setTimeout(resolve, 1000);
    });
}

// ── Chart + download ──

/**
 * Size the chart canvas to match the adjacent benchmark table (width × height, × DPR).
 *
 * @param {HTMLCanvasElement} chartCanvas - Chart canvas.
 * @param {HTMLTableElement} sizeTable - Table whose box drives chart CSS size.
 */
function layoutBenchmarkChartCanvas(chartCanvas, sizeTable) {
    const tw = Math.max(
        sizeTable.offsetWidth,
        sizeTable.scrollWidth,
        Math.ceil(sizeTable.getBoundingClientRect().width)
    );
    const th = Math.max(
        sizeTable.offsetHeight,
        sizeTable.scrollHeight,
        Math.ceil(sizeTable.getBoundingClientRect().height)
    );
    const cssW = Math.max(1, Math.ceil(tw));
    const fallbackH = Math.ceil(cssW * (CHART_REF_H / CHART_REF_W));
    const cssH = Math.max(1, th > 0 ? Math.ceil(th) : fallbackH);
    const dpr = typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    const pixW = Math.max(1, Math.round(cssW * dpr));
    const pixH = Math.max(1, Math.round(cssH * dpr));

    Object.assign(chartCanvas.style, {
        display: 'block',
        background: '#1a1a2e',
        borderRadius: '4px',
        width: `${cssW}px`,
        height: `${cssH}px`,
        marginBottom: '0',
        maxWidth: 'none',
        boxSizing: 'border-box'
    });
    chartCanvas.width = pixW;
    chartCanvas.height = pixH;
}

function refreshChartAndDownload() {
    gpuChartWrap.innerHTML = '';
    fpsChartWrap.innerHTML = '';
    chartActionsRow.innerHTML = '';

    const anyResults = storedResults.some(r => r !== null);
    if (!anyResults) return;

    const chartGpu = document.createElement('canvas');
    gpuChartWrap.appendChild(chartGpu);
    const chartEff = document.createElement('canvas');
    fpsChartWrap.appendChild(chartEff);

    const finishCharts = () => {
        layoutBenchmarkChartCanvas(chartGpu, tableGpu);
        layoutBenchmarkChartCanvas(chartEff, tableFps);
        drawBudgetChart(chartGpu, 'gpu');
        drawBudgetChart(chartEff, 'effectiveFps');
    };
    requestAnimationFrame(() => {
        requestAnimationFrame(finishCharts);
    });

    const dlText = buildDownloadText();
    const btnStyle = {
        padding: '8px 16px',
        background: '#4a9eff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: '13px'
    };

    const saveResultsBtn = document.createElement('button');
    saveResultsBtn.textContent = 'Save Results (.txt)';
    Object.assign(saveResultsBtn.style, btnStyle);
    saveResultsBtn.onclick = () => {
        const blob = new Blob([dlText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gsplat-benchmark-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };
    chartActionsRow.appendChild(saveResultsBtn);

    const saveChartBtn = document.createElement('button');
    saveChartBtn.textContent = 'Save Page (.png)';
    Object.assign(saveChartBtn.style, { ...btnStyle, marginLeft: '8px' });
    saveChartBtn.onclick = async () => {
        const blob = await pageToPngBlob();
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gsplat-benchmark-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    };
    chartActionsRow.appendChild(saveChartBtn);

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
    if (webglGpuProfilingUnavailable) {
        text += 'Note: WebGL GPU timings unavailable (no EXT_disjoint_timer_query). WebGL GPU ms are N/A; Effective FPS is still reported.\n\n';
    }
    if (storedGpuInfos.webgl2) text += `WebGL2:  ${storedGpuInfos.webgl2}\n`;
    if (storedGpuInfos.webgpu) text += `WebGPU:  ${storedGpuInfos.webgpu}\n`;
    if (storedResolution) text += `Resolution: ${storedResolution}${highRes ? ' (High Res)' : ''}\n`;
    if (idleRefFps !== null) text += `Idle ref: ~${idleRefFps.toFixed(1)} FPS (rAF)\n`;
    const ex = getExpectedBenchmarkCanvasPixels();
    text += `Next benchmark canvas (est. at export): ${ex.w} x ${ex.h} px`;
    text += ` (viewport ${window.innerWidth}x${window.innerHeight}, dpr ${ex.dpr.toFixed(2)}, maxPR ${ex.maxPR.toFixed(2)})\n`;
    text += `${'\u2550'.repeat(lineW)}\n`;
    text += [
        'Controls:',
        'Run All — all renderer columns and all budget rows.',
        'Column headers — that renderer only, all budgets.',
        `Left column (e.g. ${BUDGETS[0]}M \u2191) — every budget from ${BUDGETS[0]}M through that row, all renderers.`,
        'Right column (e.g. \u2190 10M) — only that budget, all renderers.',
        'Grid cells — that renderer only, cumulative budgets through that row.',
        '',
        `Table format (on-page): top row — GPU ms grid + chart; bottom row — Effective FPS grid + chart (${MEASURE_FRAMES} measured frames; GPU N/A if unsupported or incomplete samples).`,
        ''
    ].join('\n');

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

    const fmtGpu = g => (g >= 0 ? g.toFixed(2) : 'N/A');
    const fmtEff = f => (f > 0 ? f.toFixed(1) : '\u2014');

    text += '\nGPU Frame Time (ms)\n';
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
            line += fmtGpu(entry.avgGpu).padStart(COL_W);
        }
        text += `${line}\n`;
    }
    text += `${'\u2500'.repeat(lineW)}\n`;

    text += `\nEffective FPS (${MEASURE_FRAMES} frames / wall seconds)\n`;
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
            const ef = entry.effectiveFps ?? 0;
            line += fmtEff(ef).padStart(COL_W);
        }
        text += `${line}\n`;
    }
    text += `${'\u2500'.repeat(lineW)}\n`;

    text += `\n\n${'='.repeat(60)}\n`;
    text += 'Per-Pass GPU Timings (supported WebGPU / WebGL GPU timer runs only)\n';
    text += `${'='.repeat(60)}\n`;
    for (let c = 0; c < RENDERERS.length; c++) {
        const r = storedResults[c];
        if (!r) continue;
        const sr = /** @type {any} */ (r);
        if (sr.deviceType !== 'webgpu' && sr.deviceType !== 'webgl2') continue;
        if (sr.gpuTimingSupported === false) continue;
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
 * Full layout size of an element: scroll metrics plus max extent of large descendants.
 * Mobile Safari often under-reports scrollHeight for width:100% canvases; probing fixes chart clipping.
 *
 * @param {HTMLElement} el - Element.
 * @returns {{ w: number, h: number }} Pixel dimensions (ceil).
 */
function captureElementSize(el) {
    const rect = el.getBoundingClientRect();
    const rootTop = rect.top;
    const rootLeft = rect.left;

    let maxW = Math.max(el.scrollWidth, el.offsetWidth, rect.width);
    let maxH = Math.max(el.scrollHeight, el.offsetHeight, rect.height);

    const probe = (/** @type {Element} */ node) => {
        if (!node || typeof node.getBoundingClientRect !== 'function') return;
        const r = node.getBoundingClientRect();
        maxW = Math.max(maxW, r.right - rootLeft);
        maxH = Math.max(maxH, r.bottom - rootTop);
    };

    el.querySelectorAll('canvas, img, table, button').forEach(probe);

    return {
        w: Math.ceil(Math.max(1, maxW)),
        h: Math.ceil(Math.max(1, maxH))
    };
}

/**
 * Rasterize the benchmark page (containerEl) to a PNG blob,
 * trimming uniform #111 background edges.
 *
 * @returns {Promise<Blob|null>} PNG blob.
 */
async function pageToPngBlob() {
    const { w: W, h: H } = captureElementSize(containerEl);

    // Clone; canvases don't render inside foreignObject, so swap them for <img>.
    const clone = /** @type {HTMLElement} */ (containerEl.cloneNode(true));
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    // Hint full content width so mobile browsers lay out the clone like desktop (wide table).
    clone.style.boxSizing = 'border-box';
    clone.style.width = `${W}px`;
    clone.style.minHeight = `${H}px`;
    clone.style.overflow = 'visible';

    clone.querySelectorAll('table').forEach((t) => {
        t.style.width = 'max-content';
        t.style.maxWidth = 'none';
    });

    const lives = containerEl.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((c, i) => {
        const live = lives[i];
        const rr = live.getBoundingClientRect();
        const img = document.createElement('img');
        img.src = live.toDataURL();
        img.width = live.width;
        img.height = live.height;
        // Match on-screen CSS pixel size so foreignObject reserves full chart height (avoids squashed / clipped canvas on mobile).
        img.style.cssText = [
            'display:block',
            `background:${live.style.background || '#1a1a2e'}`,
            `border-radius:${live.style.borderRadius || '4px'}`,
            `margin-bottom:${live.style.marginBottom || '12px'}`,
            `width:${Math.ceil(rr.width)}px`,
            `height:${Math.ceil(rr.height)}px`,
            'max-width:none',
            'box-sizing:border-box'
        ].join(';');
        c.replaceWith(img);
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
    const pageImg = new Image();
    pageImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await pageImg.decode();

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(pageImg, 0, 0, W, H);

    // Trim uniform #111 margins; keep alpha so AA edges are not misclassified as bg.
    const data = ctx.getImageData(0, 0, W, H).data;
    const BG = 0x11;
    const TOL = 4;
    const PAD = 16;
    /**
     * Predicate for non-background pixels.
     * @param {number} i - Index into data (rgba byte index of R).
     * @returns {boolean} True if pixel is not uniform background.
     */
    const isContent = (i) => {
        if (data[i + 3] < 255) {
            return true;
        }
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        return Math.abs(r - BG) > TOL || Math.abs(g - BG) > TOL || Math.abs(b - BG) > TOL;
    };
    let x0 = W;
    let y0 = H;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (isContent(i)) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
            }
        }
    }
    if (x1 < 0) {
        x0 = 0;
        y0 = 0;
        x1 = W - 1;
        y1 = H - 1;
    } else {
        x0 = Math.max(0, x0 - PAD);
        y0 = Math.max(0, y0 - PAD);
        x1 = Math.min(W - 1, x1 + PAD);
        y1 = Math.min(H - 1, y1 + PAD);
    }

    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    /** @type {CanvasRenderingContext2D} */ (out.getContext('2d')).drawImage(canvas, -x0, -y0);
    return new Promise((resolve) => {
        out.toBlob(resolve, 'image/png');
    });
}

/**
 * @param {HTMLCanvasElement} chartCanvas - Canvas element.
 * @param {'gpu'|'effectiveFps'} mode - Y-axis metric.
 */
function drawBudgetChart(chartCanvas, mode) {
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;

    const W = chartCanvas.width;
    const H = chartCanvas.height;
    const scale = W / CHART_REF_W;

    const PAD = {
        top: 30 * scale,
        right: 20 * scale,
        bottom: 40 * scale,
        left: 50 * scale
    };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const COLORS = ['#ff6b6b', '#2ecc71', '#a06bff', '#f7dc6f', '#4a9eff'];

    /** X-axis range from actual results only (avoids empty space past last tested budget). */
    let chartMinM = Infinity;
    let chartMaxM = -Infinity;
    for (let c = 0; c < RENDERERS.length; c++) {
        const r = storedResults[c];
        if (!r) continue;
        const br = /** @type {any} */ (r).budgetResults;
        for (let i = 0; i < BUDGETS.length; i++) {
            if (!br[i]) continue;
            const m = BUDGETS[i];
            if (m < chartMinM) chartMinM = m;
            if (m > chartMaxM) chartMaxM = m;
        }
    }
    if (!(chartMinM <= chartMaxM)) {
        chartMinM = BUDGETS[0];
        chartMaxM = BUDGETS[BUDGETS.length - 1];
    }
    const chartSpanM = chartMaxM - chartMinM;

    /**
     * @param {number} millions - Splat budget in millions.
     * @returns {number} Canvas x in plot area.
     */
    const budgetToX = (millions) => {
        if (chartSpanM <= 0) {
            return PAD.left + plotW * 0.5;
        }
        return PAD.left + ((millions - chartMinM) / chartSpanM) * plotW;
    };

    let maxVal = 0;
    for (let c = 0; c < RENDERERS.length; c++) {
        const r = storedResults[c];
        if (!r) continue;
        const br = /** @type {any} */ (r).budgetResults;
        for (let i = 0; i < BUDGETS.length; i++) {
            if (!br[i]) continue;
            const v = mode === 'gpu' ? br[i].avgGpu : br[i].effectiveFps;
            if (mode === 'gpu' && br[i].avgGpu < 0) continue;
            if (v > maxVal) maxVal = v;
        }
    }
    maxVal = Math.ceil(maxVal * 1.15);
    if (maxVal === 0) maxVal = 1;

    ctx.strokeStyle = '#444';
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, H - PAD.bottom);
    ctx.lineTo(W - PAD.right, H - PAD.bottom);
    ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.font = `${11 * scale}px monospace`;
    ctx.textAlign = 'right';
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const v = (maxVal / yTicks) * i;
        const y = H - PAD.bottom - (i / yTicks) * plotH;
        ctx.fillText(v.toFixed(1), PAD.left - 5 * scale, y + 4 * scale);
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    for (let i = 0; i < BUDGETS.length; i++) {
        const m = BUDGETS[i];
        if (m < chartMinM || m > chartMaxM) continue;
        const x = budgetToX(m);
        ctx.fillText(`${m}M`, x, H - PAD.bottom + 18 * scale);
    }

    ctx.fillStyle = '#ccc';
    ctx.font = `${12 * scale}px monospace`;
    ctx.textAlign = 'center';
    const yLabel = mode === 'gpu' ? 'GPU frame time (ms)' : 'Effective FPS';
    ctx.fillText(
        `${yLabel} vs Splat Budget (M, linear x: ${chartMinM}M–${chartMaxM}M)`,
        W / 2,
        18 * scale
    );

    for (let c = 0; c < RENDERERS.length; c++) {
        const r = storedResults[c];
        if (!r) continue;
        const br = /** @type {any} */ (r).budgetResults;

        const color = COLORS[c % COLORS.length];
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2 * scale;

        /** @type {{x: number, y: number}[]} */
        const points = [];
        for (let i = 0; i < BUDGETS.length; i++) {
            if (!br[i]) continue;
            const v = mode === 'gpu' ? br[i].avgGpu : br[i].effectiveFps;
            if (mode === 'gpu' && br[i].avgGpu < 0) continue;
            const x = budgetToX(BUDGETS[i]);
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
            ctx.arc(pt.x, pt.y, 3 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Legend (font + spacing 1.5× prior for readability)
    const legendFontPx = 15 * scale;
    const legendLineGap = 21 * scale;
    ctx.font = `${legendFontPx}px monospace`;
    ctx.textAlign = 'left';
    for (let c = 0; c < RENDERERS.length; c++) {
        const color = COLORS[c % COLORS.length];
        const lx = PAD.left + 10 * scale;
        const ly = PAD.top + 10 * scale + c * legendLineGap;
        ctx.fillStyle = storedResults[c] ? color : '#444';
        ctx.fillRect(lx, ly - 6 * scale, 15 * scale, 5 * scale);
        ctx.fillText(RENDERERS[c].label, lx + 21 * scale, ly);
    }
}

function updateGpuInfo() {
    let text = '';
    if (idleRefFps !== null) {
        text += `Idle ref: ~${idleRefFps.toFixed(1)} FPS (rAF)\n`;
    } else {
        text += 'Idle ref: measuring\u2026\n';
    }
    const exp = getExpectedBenchmarkCanvasPixels();
    text += `Next benchmark canvas (est.): ${exp.w} x ${exp.h} px`;
    text += `  (CSS viewport ${window.innerWidth} x ${window.innerHeight}`;
    text += `, devicePixelRatio ${exp.dpr.toFixed(2)}, maxPixelRatio ${exp.maxPR.toFixed(2)}`;
    text += highRes ? ', High Res on)\n' : ')\n';
    if (storedGpuInfos.webgl2) text += `WebGL2: ${storedGpuInfos.webgl2}\n`;
    if (storedGpuInfos.webgpu) text += `WebGPU: ${storedGpuInfos.webgpu}\n`;
    if (storedResolution) text += `Resolution (last completed run): ${storedResolution}`;
    gpuInfoEl.textContent = text.trimEnd();
    syncBenchBanner();
}

/**
 * Sample main-thread / display cadence via requestAnimationFrame (~1 s) before benchmarks run.
 */
function startIdleFpsProbe() {
    if (idleRefFps !== null || idleProbeRafId !== 0) {
        return;
    }
    let frames = 0;
    const t0 = performance.now();

    function tick(now) {
        frames++;
        const elapsed = now - t0;
        if (elapsed >= IDLE_FPS_SAMPLE_MS) {
            idleProbeRafId = 0;
            idleRefFps = (frames / elapsed) * 1000;
            updateGpuInfo();
            return;
        }
        idleProbeRafId = requestAnimationFrame(tick);
    }

    idleProbeRafId = requestAnimationFrame(() => {
        idleProbeRafId = requestAnimationFrame(tick);
    });
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
            setBenchCells(`${BUDGETS[bi]}M:${colIndex}`, 'FAIL', '\u2014', '#ff6b6b');
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

    const indices = BUDGETS.map((_, i) => i).filter(i => i <= budgetIndex);
    for (let c = 0; c < RENDERERS.length; c++) {
        await runTests(c, indices); // eslint-disable-line no-await-in-loop
    }

    setTestingMode(false);
    setStatus('');
    running = false;
    setButtonsEnabled(true);
}

/**
 * @param {number} budgetIndex - Single budget (all renderers); does not run smaller budgets.
 */
async function runRowOnly(budgetIndex) {
    if (running) return;
    running = true;
    setButtonsEnabled(false);
    setTestingMode(true);

    const indices = [budgetIndex];
    for (let c = 0; c < RENDERERS.length; c++) {
        await runTests(c, indices); // eslint-disable-line no-await-in-loop
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

    const indices = BUDGETS.map((_, i) => i).filter(i => i <= budgetIndex);
    await runTests(colIndex, indices);

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

allBtns[0].onclick = runAll;

updateGpuInfo();
setTimeout(() => {
    startIdleFpsProbe();
}, 100);

const destroy = () => {
    if (idleProbeRafId) {
        cancelAnimationFrame(idleProbeRafId);
        idleProbeRafId = 0;
    }
    window.clearTimeout(uiResizeTimer);
    containerEl.remove();
    floatingStatus.remove();
};

export { destroy };
