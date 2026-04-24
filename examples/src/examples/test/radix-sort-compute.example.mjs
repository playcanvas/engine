// @config DESCRIPTION Test example for ComputeRadixSort - GPU radix sort using 4-bit compute shaders
// @config WEBGL_DISABLED
// @config HIDDEN
import files from 'examples/files';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// Create device info overlay (top center)
const deviceInfo = document.createElement('div');
deviceInfo.style.cssText = `
    position: absolute;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: white;
    background: rgba(0, 0, 0, 0.5);
    padding: 4px 8px;
    border-radius: 4px;
    z-index: 1000;
`;
document.body.appendChild(deviceInfo);

// Create error overlay (initially hidden)
const errorOverlay = document.createElement('div');
errorOverlay.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: Arial, sans-serif;
    font-size: 32px;
    font-weight: bold;
    color: #ff4444;
    background: rgba(0, 0, 0, 0.7);
    padding: 16px 32px;
    border-radius: 8px;
    z-index: 1000;
    display: none;
`;
document.body.appendChild(errorOverlay);

// Create benchmark status overlay (shown while running) and a results
// container (shown after completion). Both are full-screen-ish panels on top
// of the canvas so the user doesn't need to look at devtools.
const benchStatus = document.createElement('div');
benchStatus.style.cssText = `
    position: fixed;
    top: 120px;
    left: 50%;
    transform: translateX(-50%);
    font-family: monospace;
    font-size: 16px;
    color: #fff;
    background: rgba(0, 0, 0, 0.85);
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 1100;
    display: none;
    white-space: pre;
`;
document.body.appendChild(benchStatus);

const benchResults = document.createElement('div');
benchResults.style.cssText = `
    position: fixed;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    max-height: calc(100vh - 80px);
    width: 720px;
    max-width: 95vw;
    overflow: auto;
    font-family: monospace;
    font-size: 13px;
    color: #fff;
    background: rgba(10, 10, 15, 0.98);
    padding: 16px 20px;
    border-radius: 6px;
    z-index: 1200;
    display: none;
`;
document.body.appendChild(benchResults);

// Track sort failure count and verification state
let sortFailureCount = 0;
let verificationPending = false;
/** @type {{sortedIndices: pc.StorageBuffer, originalValues: number[], numElements: number}|null} */
let pendingVerification = null;

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// State - initialized from observer via data.set() below
/** @type {number} */
let currentNumElements = 0;
/** @type {number} */
let currentNumBits = 0;
/** @type {pc.StorageBuffer|null} */
let keysBuffer = null;
/** @type {pc.StorageBuffer|null} */
let sortedIndicesBuffer = null;
/** @type {number[]} */
let originalValues = [];
/** @type {boolean} */
let needsRegen = true;

// Valid radix modes. After benchmarking across NVIDIA / Apple / Mali / IMG
// the surviving variants are:
//   - '4-shared-mem': the universal portable multi-pass fallback
//     (ComputeRadixSort), subgroup-free, shipped as the production
//     default on every non-NVIDIA device.
//   - 'onesweep': the fused single-sweep implementation
//     (ComputeOneSweepRadixSort). Fastest on NVIDIA; unstable on Mali
//     (validates incorrectly) and Apple (GPU hangs under heavy validation
//     load), so it is selectable manually but restricted to NVIDIA in the
//     benchmark / validation sweeps.
const RADIX_MODES = {
    '4-shared-mem': { },
    'onesweep': { onesweep: true }
};
const DEFAULT_MODE = '4-shared-mem';

// Lazy cache of ComputeRadixSort / ComputeOneSweepRadixSort instances, keyed
// by the mode dropdown. Instances are created on first use and retained, so
// subsequent toggles between configurations are free (no shader rebuild).
// Each instance grows its internal buffers on demand.
/** @type {Map<string, pc.ComputeRadixSort | pc.ComputeOneSweepRadixSort>} */
const radixSortCache = new Map();

/**
 * Fetches or creates the radix sort instance matching the current observer
 * selection. Falls back to safe defaults if the observer value is not yet
 * populated.
 *
 * @returns {pc.ComputeRadixSort | pc.ComputeOneSweepRadixSort} The active
 * radix sort instance.
 */
function getActiveRadixSort() {
    const mode = data.get('options.mode') ?? DEFAULT_MODE;
    const modeCfg = RADIX_MODES[mode] ?? RADIX_MODES[DEFAULT_MODE];
    let inst = radixSortCache.get(mode);
    if (!inst) {
        inst = modeCfg.onesweep ?
            new pc.ComputeOneSweepRadixSort(device) :
            new pc.ComputeRadixSort(device);
        radixSortCache.set(mode, inst);
    }
    return inst;
}

/**
 * Build a device identity string. Shared by the interactive device overlay
 * and the benchmark / validation result overlays so the reported GPU
 * metadata stays consistent across every surface.
 *
 * The subgroup range is the big one: our OneSweep and 8-bit subgroup
 * kernels hardcode `MAX_SUBGROUPS = 8` assuming `sgSize == 32`, so when a
 * device advertises subgroups with a different size every subgroup kernel
 * will silently produce corrupt output. Surfacing min/max subgroup size in
 * the results header makes that easy to diagnose.
 *
 * @param {string} sep - Separator glyph between segments (e.g. '-' or '·').
 * @returns {string} Formatted line, suitable for both plaintext and HTML.
 */
function buildGpuLine(sep) {
    const dev = /** @type {any} */ (device);
    let line = `Device: ${device.deviceType.toUpperCase()}`;
    if (device.isWebGPU && dev.gpuAdapter?.info) {
        const info = dev.gpuAdapter.info;
        line += `  ${sep}  ${info.vendor || '?'} / ${info.architecture || info.device || '?'}`;
    }
    if (device.isWebGPU) {
        // Read from device fields captured at init (adapter.limits for
        // subgroup entries can be cleared after requestDevice on some
        // browsers, so a live re-read is unreliable - e.g. on M4 Chrome).
        const maxSg = device.maxSubgroupSize;
        const minSg = device.minSubgroupSize;
        if (device.supportsSubgroups && maxSg) {
            const range = (minSg && minSg !== maxSg) ? `${minSg}-${maxSg}` : `${maxSg}`;
            line += `  ${sep}  subgroup: ${range}`;
        } else if (device.supportsSubgroups) {
            line += `  ${sep}  subgroup: yes`;
        } else {
            line += `  ${sep}  subgroup: none`;
        }
    }
    return line;
}

/**
 * Refreshes the device overlay text to reflect the active configuration.
 */
function updateDeviceInfo() {
    const mode = data.get('options.mode') ?? DEFAULT_MODE;
    const sort = getActiveRadixSort();
    deviceInfo.textContent = `${buildGpuLine('-')} - mode: ${mode} - radix: ${sort.radixBits}bit`;
}

updateDeviceInfo();

// ==================== MATERIALS ====================

// Create unsorted visualization material (WGSL only for WebGPU)
const unsortedMaterial = new pc.ShaderMaterial({
    uniqueName: 'UnsortedVizMaterialCompute',
    vertexWGSL: files['vert.wgsl'],
    fragmentWGSL: files['wgsl.frag'],
    attributes: {
        aPosition: pc.SEMANTIC_POSITION,
        aUv0: pc.SEMANTIC_TEXCOORD0
    }
});

// Create sorted visualization material (WGSL only for WebGPU)
// Uses same shader as unsorted but with SORTED define
const sortedMaterial = new pc.ShaderMaterial({
    uniqueName: 'SortedVizMaterialCompute',
    vertexWGSL: files['vert.wgsl'],
    fragmentWGSL: files['wgsl.frag'],
    attributes: {
        aPosition: pc.SEMANTIC_POSITION,
        aUv0: pc.SEMANTIC_TEXCOORD0
    }
});
sortedMaterial.setDefine('SORTED', true);

// ==================== SCENE SETUP ====================

// Create camera entity
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.15),
    projection: pc.PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 1
});
camera.setPosition(0, 0, 1);
app.root.addChild(camera);

// Create unsorted visualization plane (top half)
const unsortedPlane = new pc.Entity('unsortedPlane');
unsortedPlane.addComponent('render', {
    type: 'plane',
    material: unsortedMaterial,
    castShadows: false,
    receiveShadows: false
});
unsortedPlane.setLocalPosition(0, 0.5, 0);
unsortedPlane.setLocalScale(2, 1, 1);
unsortedPlane.setEulerAngles(90, 0, 0);
unsortedPlane.enabled = false;
app.root.addChild(unsortedPlane);

// Create sorted visualization plane (bottom half)
const sortedPlane = new pc.Entity('sortedPlane');
sortedPlane.addComponent('render', {
    type: 'plane',
    material: sortedMaterial,
    castShadows: false,
    receiveShadows: false
});
sortedPlane.setLocalPosition(0, -0.5, 0);
sortedPlane.setLocalScale(2, 1, 1);
sortedPlane.setEulerAngles(90, 0, 0);
sortedPlane.enabled = false;
app.root.addChild(sortedPlane);

// Create spinning cube for visual frame rate indicator
const cube = new pc.Entity('cube');
cube.addComponent('render', {
    type: 'box'
});
cube.setLocalPosition(0, 0, 0.3);
cube.setLocalScale(0.15, 0.15, 0.15);
app.root.addChild(cube);

// Create directional light for the cube
const light = new pc.Entity('light');
light.addComponent('light');
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculates the optimal texture size for storing N elements.
 *
 * @param {number} numElements - Number of elements.
 * @returns {{width: number, height: number}} Texture dimensions.
 */
function calcTextureSize(numElements) {
    const pixels = Math.ceil(numElements);
    const size = Math.ceil(Math.sqrt(pixels));
    return { width: size, height: size };
}

/**
 * Recreates the keys buffer and generates random data.
 */
function regenerateData() {
    const numElements = currentNumElements;
    const numBits = currentNumBits;
    const maxValue = numBits >= 32 ? 0xFFFFFFFF : (1 << numBits) - 1;

    // Destroy old buffer
    if (keysBuffer) {
        keysBuffer.destroy();
    }

    // Create storage buffer for keys
    keysBuffer = new pc.StorageBuffer(device, numElements * 4, pc.BUFFERUSAGE_COPY_SRC | pc.BUFFERUSAGE_COPY_DST);

    // Generate random test data
    const keysData = new Uint32Array(numElements);
    originalValues = [];

    for (let i = 0; i < numElements; i++) {
        const value = Math.floor(Math.random() * maxValue);
        keysData[i] = value;
        originalValues.push(value);
    }

    // Upload to GPU
    keysBuffer.write(0, keysData);

    needsRegen = false;
}

/**
 * Runs the GPU sort.
 *
 * @param {boolean} [verify] - Whether to verify results.
 */
function runSort(verify = false) {
    if (!keysBuffer) return;

    const sort = getActiveRadixSort();
    // Round up numBits to a multiple of the active radix width so the sort
    // asserts don't fire when the user picks e.g. 12 bits while in 8-bit mode.
    // Keys never exceed (1 << currentNumBits) - 1 (see regenerateData), so
    // sorting with extra high bits is still correct.
    const alignedBits = Math.ceil(currentNumBits / sort.radixBits) * sort.radixBits;
    sortedIndicesBuffer = sort.sort(keysBuffer, currentNumElements, alignedBits);

    // Update visualization materials
    updateMaterialParameters();

    // Verify results if requested
    if (verify) {
        verifyResults(sortedIndicesBuffer);
    }
}

/**
 * Updates material parameters for visualization.
 */
function updateMaterialParameters() {
    if (!keysBuffer || !sortedIndicesBuffer) {
        return;
    }

    const maxValue = currentNumBits >= 32 ? 0xFFFFFFFF : (1 << currentNumBits) - 1;
    const { width, height } = calcTextureSize(currentNumElements);

    // Update unsorted material
    unsortedMaterial.setParameter('keysBuffer', keysBuffer);
    unsortedMaterial.setParameter('maxValue', maxValue);
    unsortedMaterial.setParameter('elementCount', currentNumElements);
    unsortedMaterial.setParameter('textureSize', [width, height]);
    unsortedMaterial.update();

    // Update sorted material
    sortedMaterial.setParameter('keysBuffer', keysBuffer);
    sortedMaterial.setParameter('sortedIndices', sortedIndicesBuffer);
    sortedMaterial.setParameter('maxValue', maxValue);
    sortedMaterial.setParameter('elementCount', currentNumElements);
    sortedMaterial.setParameter('textureSize', [width, height]);
    sortedMaterial.update();
}

/**
 * Downloads and verifies the sorted results against CPU-sorted reference.
 *
 * @param {pc.StorageBuffer} sortedIndices - The sorted indices buffer to verify.
 */
function verifyResults(sortedIndices) {
    // If verification already in progress, queue this one (replacing any previously queued)
    if (verificationPending) {
        pendingVerification = {
            sortedIndices: sortedIndices,
            originalValues: originalValues.slice(),
            numElements: currentNumElements
        };
        return;
    }

    verificationPending = true;

    // Capture state at time of call
    const capturedOriginalValues = originalValues.slice();
    const capturedNumElements = currentNumElements;

    doVerification(sortedIndices, capturedOriginalValues, capturedNumElements).then(processNextVerification);
}

/**
 * Process the next queued verification if any.
 */
function processNextVerification() {
    verificationPending = false;

    if (pendingVerification) {
        const pending = pendingVerification;
        pendingVerification = null;
        verificationPending = true;
        doVerification(pending.sortedIndices, pending.originalValues, pending.numElements).then(processNextVerification);
    }
}

/**
 * Performs the actual verification with pre-captured data.
 *
 * @param {pc.StorageBuffer} sortedIndices - The sorted indices buffer.
 * @param {number[]} capturedOriginalValues - Copy of original values at sort time.
 * @param {number} capturedNumElements - Number of elements at sort time.
 */
async function doVerification(sortedIndices, capturedOriginalValues, capturedNumElements) {
    if (!sortedIndices) {
        console.error('No sorted indices buffer available');
        errorOverlay.style.display = 'block';
        return;
    }

    // Read the sorted indices buffer
    const indicesData = new Uint32Array(capturedNumElements);
    await sortedIndices.read(0, capturedNumElements * 4, indicesData, true);

    // Get sorted values by looking up original values
    const sortedValues = [];
    for (let i = 0; i < capturedNumElements; i++) {
        sortedValues.push(capturedOriginalValues[indicesData[i]]);
    }

    // CPU sort a copy of original values for reference
    const cpuSorted = capturedOriginalValues.slice().sort((a, b) => a - b);

    // Compare GPU result against CPU reference. Keep the first and last 5
    // mismatches so we can see both where corruption starts and whether the
    // tail of the array is also off (e.g. a shift-by-one cascade drops the
    // last element and duplicates an earlier one).
    let errorCount = 0;
    const firstErrors = [];
    /** @type {{i: number, gpu: number, expected: number}[]} */
    const lastErrors = [];
    const TAIL_SIZE = 5;
    for (let i = 0; i < capturedNumElements; i++) {
        if (sortedValues[i] !== cpuSorted[i]) {
            if (firstErrors.length < 5) {
                firstErrors.push({ i: i, gpu: sortedValues[i], expected: cpuSorted[i] });
            }
            lastErrors.push({ i: i, gpu: sortedValues[i], expected: cpuSorted[i] });
            if (lastErrors.length > TAIL_SIZE) {
                lastErrors.shift();
            }
            errorCount++;
        }
    }

    if (errorCount > 0) {
        sortFailureCount++;
        console.error(`✗ [${device.deviceType}] Array is NOT correctly sorted (${errorCount} errors, ${(errorCount / capturedNumElements * 100).toFixed(2)}%)`);
        for (const e of firstErrors) {
            console.error(`  First mismatch at index ${e.i}: GPU=${e.gpu}, expected=${e.expected}`);
        }
        // Avoid double-logging when the total error count fits in the first window.
        if (errorCount > firstErrors.length) {
            for (const e of lastErrors) {
                console.error(`  Last  mismatch at index ${e.i}: GPU=${e.gpu}, expected=${e.expected}`);
            }
        }
        // Dump the final few GPU/expected pairs unconditionally so we can
        // confirm whether the very end of the array is shifted (a stable
        // shift-by-one drops the last original element) or intact.
        const tailStart = Math.max(0, capturedNumElements - TAIL_SIZE);
        for (let i = tailStart; i < capturedNumElements; i++) {
            const marker = sortedValues[i] !== cpuSorted[i] ? '✗' : '✓';
            console.error(`  Tail ${marker} index ${i}: GPU=${sortedValues[i]}, expected=${cpuSorted[i]}`);
        }
        errorOverlay.textContent = `SORT ERROR (${sortFailureCount} failures)`;
        errorOverlay.style.display = 'block';
    } else {
        console.log(`✓ Sort verified (${capturedNumElements} elements)`);
        errorOverlay.style.display = 'none';
    }
}

// Handle control changes from data binding
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    if (path === 'options.elementsK') {
        const newElements = value * 1000;
        if (newElements !== currentNumElements) {
            currentNumElements = newElements;
            needsRegen = true;
        }
    } else if (path === 'options.bits') {
        // Snap to a multiple of 8 so the bit count is compatible with both
        // 4-bit and 8-bit radix modes without realignment at sort time.
        const validBits = [8, 16, 24, 32];
        const nearest = validBits.reduce((prev, curr) => (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev)
        );
        if (nearest !== currentNumBits) {
            currentNumBits = nearest;
            needsRegen = true;
        }
    } else if (path === 'options.mode') {
        // Switching radix mode changes the active shader set; force a
        // re-sort on next frame and refresh the overlay.
        needsRegen = true;
        updateDeviceInfo();
    } else if (path === 'options.validation' && !value) {
        // Clear any stale error overlay when validation is turned off -
        // a previous failure is no longer being re-checked each frame.
        errorOverlay.style.display = 'none';
    }
});

// Initialize observer with default values (single source of truth for defaults)
// Must be after data.on() so the handler receives the initial values.
data.set('options', {
    elementsK: 1000,
    bits: 16,
    mode: DEFAULT_MODE,
    render: true,
    validation: true,
    benchMaxElements: 10_000_000
});

// ==================== BENCHMARK ====================

// Benchmark covers the full dynamic range we care about for gsplat sorts.
// 100K and 500K expose per-dispatch fixed-cost floors; 30M+ probes DRAM
// bandwidth ceilings. 24-bit keys is the gsplat-representative bit width.
const BENCH_SIZES = [
    100_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000,
    5_000_000, 6_000_000, 8_000_000, 10_000_000, 15_000_000,
    20_000_000, 25_000_000, 30_000_000, 40_000_000, 50_000_000
];
// The benchmark and validation matrix mirrors the production decision:
//   - 4-bit is the universal portable fallback (every non-NVIDIA device:
//     Apple, Mali, etc.). Chosen over 6-bit because 6-bit regresses badly
//     on Apple M1/M2 in the 4-8M target range, which is the range we
//     actually care about on those GPUs.
//   - OneSweep is the production fastpath on NVIDIA; it's unstable on Mali
//     (validates incorrectly) and Apple (GPU hangs under heavy validation
//     load on M1), so it's restricted to NVIDIA here.
const _nvidia = (device.gpuAdapter?.info?.vendor || '').toLowerCase().includes('nvidia');
const BENCH_CONFIGS = [
    { label: '4-bit', modeKey: '4-shared-mem' },
    ...(_nvidia ? [{ label: 'OneSweep', modeKey: 'onesweep' }] : [])
];
const BENCH_WARMUP = 20;
const BENCH_MEASURE = 50;
const BENCH_BITS = 24;

// Passes that are not part of the sort itself - excluded from per-cell
// totals and per-pass breakdowns. `Forward` is the main PlayCanvas forward
// render pass; its cost (and serialization-behind-compute timing artefacts)
// would pollute the sort-only comparison.
const BENCH_EXCLUDED_PASSES = new Set(['Forward']);

/**
 * @type {null | {
 *     phase: 'setup' | 'warmup' | 'measure',
 *     sizes: number[],
 *     sizeIdx: number,
 *     configIdx: number,
 *     frame: number,
 *     frameTimes: number[],
 *     passAccum: Map<string, number[]>,
 *     sortInst: pc.ComputeRadixSort | pc.ComputeOneSweepRadixSort | null,
 *     keysBuf: pc.StorageBuffer | null,
 *     results: {size: number, configLabel: string, frameMs: number, passMs: Map<string, number>}[],
 *     saved: {elementsK: any, bits: any, mode: any, render: any, validation: any, profilerEnabled: boolean}
 * }}
 */
let benchState = null;

/**
 * Format an element count compactly (e.g. 1_500_000 -> "1.5M").
 *
 * @param {number} n - Count.
 * @returns {string} Formatted count.
 */
function fmtN(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return `${n}`;
}

/**
 * Create a fresh sort instance for the given mode key. Bypasses the
 * per-user radixSortCache so benchmark lifetimes are independent of the
 * interactive UI state.
 *
 * @param {string} modeKey - Entry key into RADIX_MODES.
 * @returns {pc.ComputeRadixSort | pc.ComputeOneSweepRadixSort} Sort instance.
 */
function createBenchSort(modeKey) {
    const modeCfg = RADIX_MODES[modeKey];
    return modeCfg.onesweep ?
        new pc.ComputeOneSweepRadixSort(device) :
        new pc.ComputeRadixSort(device);
}

/**
 * Fill a StorageBuffer with random 24-bit keys. Creates a new buffer
 * sized to numElements and uploads it.
 *
 * @param {number} numElements - Number of elements.
 * @returns {pc.StorageBuffer} Uploaded keys buffer.
 */
function createBenchKeys(numElements) {
    const maxValue = (1 << BENCH_BITS) - 1;
    const buf = new pc.StorageBuffer(device, numElements * 4, pc.BUFFERUSAGE_COPY_SRC | pc.BUFFERUSAGE_COPY_DST);
    const keysData = new Uint32Array(numElements);
    for (let i = 0; i < numElements; i++) {
        keysData[i] = Math.floor(Math.random() * maxValue);
    }
    buf.write(0, keysData);
    return buf;
}

/**
 * Display the benchmark status overlay.
 *
 * @param {string} text - Status text to show.
 */
function showBenchStatus(text) {
    benchStatus.textContent = text;
    benchStatus.style.display = 'block';
}

/**
 * Start a benchmark run. Snapshots current settings, disables rendering
 * and validation, enables the GPU profiler, and kicks off the state
 * machine. Subsequent ticks happen inside the app update loop.
 */
function startBenchmark() {
    if (benchState) return;

    // Filter the benchmark size sweep to respect the user-selected upper
    // bound from the Benchmark panel.
    const maxN = /** @type {number} */ (data.get('options.benchMaxElements') ?? 10_000_000);
    const sizes = BENCH_SIZES.filter(n => n <= maxN);
    if (sizes.length === 0) {
        showBenchStatus('No benchmark sizes selected.');
        setTimeout(() => {
            benchStatus.style.display = 'none';
        }, 1500);
        return;
    }

    // Snapshot interactive state - restored on completion.
    const saved = {
        elementsK: data.get('options.elementsK'),
        bits: data.get('options.bits'),
        mode: data.get('options.mode'),
        render: data.get('options.render'),
        validation: data.get('options.validation'),
        profilerEnabled: !!(device.gpuProfiler && device.gpuProfiler.enabled)
    };

    // Force off visualization (saves fragment shader cost during timing) and
    // hide any stale error overlay from a prior interactive session.
    unsortedPlane.enabled = false;
    sortedPlane.enabled = false;
    errorOverlay.style.display = 'none';
    benchResults.style.display = 'none';

    if (device.gpuProfiler) {
        device.gpuProfiler.enabled = true;
    }

    benchState = {
        phase: 'setup',
        sizes: sizes,
        sizeIdx: 0,
        configIdx: 0,
        frame: 0,
        frameTimes: [],
        passAccum: new Map(),
        sortInst: null,
        keysBuf: null,
        results: [],
        saved
    };
    showBenchStatus('Starting benchmark...');
}

/**
 * Advance the benchmark state machine by one frame. Called from the app
 * update loop in lieu of the normal sort-every-frame behaviour while a
 * benchmark is active.
 */
function stepBenchmark() {
    const s = /** @type {NonNullable<typeof benchState>} */ (benchState);
    const cfg = BENCH_CONFIGS[s.configIdx];
    const size = s.sizes[s.sizeIdx];

    if (s.phase === 'setup') {
        // First frame for this (size, config). Allocate a fresh sort
        // instance and fresh keys (identical across configs for the same
        // size by virtue of the RNG seeding, but since we're measuring
        // per-config-and-size there's no need to share).
        //
        // We recreate the sort instance for each (config, size) so that
        // capacity growth from earlier smaller sizes doesn't leak into
        // timings (the current allocation scheme only grows).
        if (s.sortInst) {
            s.sortInst.destroy();
        }
        if (s.keysBuf) {
            s.keysBuf.destroy();
        }

        showBenchStatus(`[${cfg.label}]  ${fmtN(size)}  allocating & uploading keys...`);
        s.sortInst = createBenchSort(cfg.modeKey);
        s.keysBuf = createBenchKeys(size);

        // Round up to the sort's radix width (same alignment rule the
        // interactive path uses).
        const alignedBits = Math.ceil(BENCH_BITS / s.sortInst.radixBits) * s.sortInst.radixBits;

        // Prime: one throwaway sort so shader compilation, pipeline
        // creation and buffer allocations land outside the warmup window.
        s.sortInst.sort(s.keysBuf, size, alignedBits);

        s.phase = 'warmup';
        s.frame = 0;
        s.frameTimes = [];
        s.passAccum = new Map();
        return;
    }

    // Active phases (warmup / measure): run one sort per frame.
    const sort = /** @type {NonNullable<typeof s.sortInst>} */ (s.sortInst);
    const keys = /** @type {NonNullable<typeof s.keysBuf>} */ (s.keysBuf);
    const alignedBits = Math.ceil(BENCH_BITS / sort.radixBits) * sort.radixBits;
    sort.sort(keys, size, alignedBits);

    s.frame++;

    if (s.phase === 'warmup') {
        showBenchStatus(`[${cfg.label}]  ${fmtN(size)}  warmup  ${s.frame}/${BENCH_WARMUP}`);
        if (s.frame >= BENCH_WARMUP) {
            s.phase = 'measure';
            s.frame = 0;
        }
        return;
    }

    // phase === 'measure': collect timings from the previous frame's work.
    // Timestamp queries resolve async so the values we read now correspond
    // to the sort dispatched ~1 frame ago; over MEASURE frames this is
    // amortized away. We deliberately exclude the `Forward` (scene render)
    // pass - it's not part of the sort, and Metal/WebGPU timing of compute
    // followed by graphics serializes in a way that inflates its reported
    // time in proportion to the preceding compute workload. The total we
    // record is therefore the sum of sort-related passes only.
    const gp = device.gpuProfiler;
    if (gp && gp.passTimings.size > 0) {
        let sortMs = 0;
        for (const [name, t] of gp.passTimings) {
            if (BENCH_EXCLUDED_PASSES.has(name)) continue;
            sortMs += t;
            let arr = s.passAccum.get(name);
            if (!arr) {
                arr = [];
                s.passAccum.set(name, arr);
            }
            arr.push(t);
        }
        if (sortMs > 0) s.frameTimes.push(sortMs);
    }
    showBenchStatus(`[${cfg.label}]  ${fmtN(size)}  measure ${s.frame}/${BENCH_MEASURE}`);

    if (s.frame < BENCH_MEASURE) return;

    // Aggregate this (size, config) into a result row.
    const mean = (/** @type {number[]} */ arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    /** @type {Map<string, number>} */
    const passMs = new Map();
    for (const [name, arr] of s.passAccum) {
        passMs.set(name, mean(arr));
    }
    s.results.push({
        size: size,
        configLabel: cfg.label,
        frameMs: mean(s.frameTimes),
        passMs: passMs
    });

    // Order: inner loop is config (so both configs at the same size are
    // measured back-to-back, equalizing GPU boost-clock / thermal state
    // across configs at that size). Outer loop is size.
    s.configIdx++;
    if (s.configIdx >= BENCH_CONFIGS.length) {
        s.configIdx = 0;
        s.sizeIdx++;
    }

    if (s.sizeIdx >= s.sizes.length) {
        finishBenchmark();
        return;
    }
    s.phase = 'setup';
}

/**
 * Finalize benchmark: clean up GPU resources, restore user settings,
 * render results overlay, and log a plaintext table to the console.
 */
function finishBenchmark() {
    const s = /** @type {NonNullable<typeof benchState>} */ (benchState);

    if (s.sortInst) s.sortInst.destroy();
    if (s.keysBuf) s.keysBuf.destroy();

    const results = s.results;
    const saved = s.saved;

    benchState = null;
    benchStatus.style.display = 'none';

    // Restore GPU profiler to whatever the user had (usually off).
    if (device.gpuProfiler) {
        device.gpuProfiler.enabled = saved.profilerEnabled;
    }

    // Hide the device info HUD so it doesn't overlap the results title, and
    // keep the visualization planes disabled while the overlay is shown -
    // restoring both only when the user clicks Close. We don't restore the
    // render / elementsK / bits / mode observer values here for the same
    // reason: doing so would trigger regen and a visible cube / planes
    // flicker behind the results. Close defers that until it's actually
    // needed.
    deviceInfo.style.display = 'none';
    unsortedPlane.enabled = false;
    sortedPlane.enabled = false;

    renderBenchResults(results, () => {
        deviceInfo.style.display = '';
        data.set('options.elementsK', saved.elementsK);
        data.set('options.bits', saved.bits);
        data.set('options.mode', saved.mode);
        data.set('options.render', saved.render);
        data.set('options.validation', saved.validation);
    });
    console.log(benchResultsPlaintext(results));
}

/**
 * Render the benchmark results as a table in the overlay.
 *
 * @param {{size: number, configLabel: string, frameMs: number, passMs: Map<string, number>}[]} results - Benchmark results.
 * @param {() => void} onClose - Called when the user clicks Close.
 */
function renderBenchResults(results, onClose) {
    // Group results by size - columns are configs. `sizes` preserves the
    // actual measured sizes (may be a subset of BENCH_SIZES when the user
    // capped the sweep via the Benchmark panel), sorted ascending.
    /** @type {Map<number, Map<string, {frameMs: number, passMs: Map<string, number>}>>} */
    const bySize = new Map();
    for (const r of results) {
        let row = bySize.get(r.size);
        if (!row) {
            row = new Map();
            bySize.set(r.size, row);
        }
        row.set(r.configLabel, { frameMs: r.frameMs, passMs: r.passMs });
    }
    const sizes = [...bySize.keys()].sort((a, b) => a - b);

    const gpuLine = buildGpuLine('·');

    const baseline = BENCH_CONFIGS[0].label;

    // Explicit palette - PCUI's default styles inherit into the overlay and
    // drag text toward panel-background grey, so we pin every cell to a
    // high-contrast foreground.
    const TXT = '#e6e6e6';
    const MUTED = '#aaa';
    const HDR_BG = '#1e1e24';

    // Column count for the details-row colspan: Size + 1 per baseline +
    // 2 per non-baseline (time + speedup) + Details.
    const totalCols = 2 + (BENCH_CONFIGS.length - 1) * 2 + 1;

    let html = '';
    html += `<div style="color:${TXT};">`;
    html += `<div style="font-size:15px;margin-bottom:4px;font-weight:bold;color:${TXT};">Radix Sort Benchmark</div>`;
    html += `<div style="color:${MUTED};margin-bottom:4px;">${gpuLine}</div>`;
    html += `<div style="color:${MUTED};margin-bottom:12px;">${BENCH_BITS}-bit keys  ·  ${BENCH_WARMUP} warmup + ${BENCH_MEASURE} measured frames per cell  ·  sort-only GPU time in ms (Forward pass excluded)</div>`;

    // Line chart placeholder; filled in by drawBenchChart() after the
    // overlay HTML is committed to the DOM.
    html += '<canvas id="bench-chart" width="700" height="320" style="display:block;background:#1a1a2e;border-radius:4px;width:100%;max-width:700px;margin-bottom:14px;"></canvas>';

    html += `<table style="border-collapse:collapse;margin-bottom:14px;width:100%;color:${TXT};">`;
    html += `<thead><tr style="background:${HDR_BG};">`;
    const th = `style="text-align:right;padding:5px 10px;border-bottom:1px solid #444;color:${TXT};"`;
    html += `<th ${th}>Size</th>`;
    for (let c = 0; c < BENCH_CONFIGS.length; c++) {
        const cfg = BENCH_CONFIGS[c];
        html += `<th ${th}>${cfg.label} (ms)</th>`;
        // Non-baseline configs get an adjacent speedup-vs-baseline column.
        if (c > 0) html += `<th ${th}>vs ${baseline}</th>`;
    }
    html += `<th style="text-align:center;padding:5px 10px;border-bottom:1px solid #444;color:${TXT};">Details</th>`;
    html += '</tr></thead><tbody>';

    const td = `style="text-align:right;padding:3px 10px;color:${TXT};"`;

    for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];
        const row = bySize.get(size);
        if (!row) continue;

        // Zebra striping for readability at a glance.
        const rowBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)';
        const b = row.get(baseline)?.frameMs ?? 0;

        html += `<tr style="background:${rowBg};">`;
        html += `<td ${td}>${fmtN(size)}</td>`;
        for (let c = 0; c < BENCH_CONFIGS.length; c++) {
            const cfg = BENCH_CONFIGS[c];
            const v = row.get(cfg.label)?.frameMs ?? 0;
            html += `<td ${td}>${v ? v.toFixed(2) : '—'}</td>`;
            if (c > 0) {
                const speedup = (b > 0 && v > 0) ? (b / v) : 0;
                const spColor = speedup >= 1 ? '#78e37a' : '#e87878';
                html += `<td style="text-align:right;padding:3px 10px;color:${spColor};">${speedup ? `${speedup.toFixed(2)}×` : '—'}</td>`;
            }
        }
        html += `<td style="text-align:center;padding:3px 10px;color:${TXT};"><button data-toggle="${i}" style="background:transparent;color:${TXT};border:1px solid #555;border-radius:3px;padding:1px 8px;cursor:pointer;font-family:monospace;font-size:11px;">▸</button></td>`;
        html += '</tr>';

        // Hidden detail row below, one per size. Shows per-pass breakdown
        // for all configs side by side; revealed by the toggle button.
        html += `<tr data-detail-content="${i}" style="display:none;background:${rowBg};">`;
        html += `<td colspan="${totalCols}" style="padding:6px 24px 10px 24px;color:${TXT};">`;
        html += '<div style="display:flex;gap:24px;flex-wrap:wrap;">';
        for (const cfg of BENCH_CONFIGS) {
            const entry = row.get(cfg.label);
            if (!entry) continue;
            const passes = [...entry.passMs.entries()].sort((a, b) => b[1] - a[1]);
            html += '<div style="min-width:260px;">';
            html += `<div style="color:${TXT};margin-bottom:2px;font-weight:bold;">${cfg.label}  <span style="color:${MUTED};font-weight:normal;">(${entry.frameMs.toFixed(2)} ms)</span></div>`;
            if (passes.length === 0) {
                html += `<div style="color:${MUTED};padding-left:8px;">(no pass timings)</div>`;
            } else {
                for (const [name, t] of passes) {
                    html += `<div style="color:${MUTED};padding-left:8px;white-space:nowrap;"><span style="display:inline-block;width:54px;text-align:right;color:${TXT};">${t.toFixed(3)}</span>  ${name}</div>`;
                }
            }
            html += '</div>';
        }
        html += '</div></td></tr>';
    }
    html += '</tbody></table>';

    html += '<div style="margin-top:14px;display:flex;gap:8px;">';
    html += '<button id="bench-save-btn" style="background:#3a8a3a;color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:monospace;font-size:13px;">Save to file</button>';
    html += '<button id="bench-close-btn" style="background:#4a9eff;color:#fff;border:none;border-radius:3px;padding:6px 14px;cursor:pointer;font-family:monospace;font-size:13px;">Close</button>';
    html += '</div>';
    html += '</div>';

    benchResults.innerHTML = html;
    benchResults.style.display = 'block';

    // Render the line chart into the <canvas> now that it's in the DOM.
    const chartCanvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('bench-chart'));
    if (chartCanvas) {
        drawBenchChart(chartCanvas, bySize, sizes);
    }

    // Wire up per-row toggles. Each button flips the matching detail row
    // and swaps its caret glyph.
    const toggles = benchResults.querySelectorAll('button[data-toggle]');
    toggles.forEach((btn) => {
        const b = /** @type {HTMLButtonElement} */ (btn);
        b.onclick = () => {
            const idx = b.getAttribute('data-toggle');
            const detailRow = /** @type {HTMLElement | null} */ (
                benchResults.querySelector(`tr[data-detail-content="${idx}"]`)
            );
            if (!detailRow) return;
            const isOpen = detailRow.style.display !== 'none';
            detailRow.style.display = isOpen ? 'none' : '';
            b.textContent = isOpen ? '▸' : '▾';
        };
    });

    const saveBtn = document.getElementById('bench-save-btn');
    if (saveBtn) {
        saveBtn.onclick = () => {
            downloadText(benchFilename(), benchResultsPlaintext(results, true));
        };
    }

    const closeBtn = document.getElementById('bench-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            benchResults.style.display = 'none';
            onClose();
        };
    }
}

/**
 * Draw a line chart of sort time (ms) vs element count, one line per
 * benchmark config. Sizes are evenly spaced on the X axis (index-based)
 * so every measured point gets equal visual weight regardless of the
 * 500x range between smallest and largest test.
 *
 * @param {HTMLCanvasElement} chartCanvas - Target canvas.
 * @param {Map<number, Map<string, {frameMs: number, passMs: Map<string, number>}>>} bySize - Results grouped by size then config label.
 * @param {number[]} sizes - Tested sizes, sorted ascending.
 */
function drawBenchChart(chartCanvas, bySize, sizes) {
    const ctx = chartCanvas.getContext('2d');
    if (!ctx || sizes.length === 0) return;

    const W = chartCanvas.width;
    const H = chartCanvas.height;
    const PAD = { top: 30, right: 20, bottom: 40, left: 50 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const COLORS = ['#ff6b6b', '#2ecc71', '#a06bff', '#f7dc6f', '#4dabff', '#ff9f43', '#ec87c0', '#48c9b0'];

    // Log-Y. Sort timings routinely span 2-3 decades across the sweep
    // (e.g. 0.1 ms at 100K vs 70 ms at 50M), so linear-Y squashes the
    // small-N region into invisibility. On log-Y a fixed speedup ratio
    // always takes the same vertical space regardless of absolute ms.
    let minVal = Infinity;
    let maxVal = 0;
    for (const row of bySize.values()) {
        for (const cell of row.values()) {
            if (cell.frameMs > 0) {
                if (cell.frameMs < minVal) minVal = cell.frameMs;
                if (cell.frameMs > maxVal) maxVal = cell.frameMs;
            }
        }
    }
    if (!isFinite(minVal) || maxVal === 0) {
        minVal = 0.1;
        maxVal = 1;
    }

    // Snap to decades so gridlines land on clean values (0.1, 1, 10, ...).
    // Always widen by at least one decade so tiny ranges still draw nicely.
    const logMin = Math.floor(Math.log10(minVal));
    let logMax = Math.ceil(Math.log10(maxVal));
    if (logMax <= logMin) logMax = logMin + 1;
    const logRange = logMax - logMin;

    /**
     * @param {number} v - Value in ms.
     * @returns {number} Pixel Y.
     */
    const yOf = (v) => {
        const lv = Math.log10(Math.max(v, 10 ** (logMin - 2)));
        return H - PAD.bottom - ((lv - logMin) / logRange) * plotH;
    };

    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, H - PAD.bottom);
    ctx.lineTo(W - PAD.right, H - PAD.bottom);
    ctx.stroke();

    // Decade gridlines + labels, plus unlabelled minor lines at 2x/5x
    // within each decade so the eye can still read sub-decade spacing.
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    for (let d = logMin; d <= logMax; d++) {
        const decade = 10 ** d;
        const y = yOf(decade);
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();
        ctx.fillStyle = '#888';
        const label = decade >= 1 ? decade.toFixed(0) : decade.toFixed(Math.max(0, -d));
        ctx.fillText(label, PAD.left - 5, y + 4);

        if (d < logMax) {
            ctx.strokeStyle = '#222';
            for (const m of [2, 5]) {
                const ym = yOf(decade * m);
                ctx.beginPath();
                ctx.moveTo(PAD.left, ym);
                ctx.lineTo(W - PAD.right, ym);
                ctx.stroke();
            }
        }
    }

    // X ticks: label every size if there's room, otherwise stride so labels
    // don't overlap.
    const stride = sizes.length > 10 ? Math.ceil(sizes.length / 10) : 1;
    const denom = Math.max(1, sizes.length - 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    for (let i = 0; i < sizes.length; i++) {
        if (i % stride !== 0 && i !== sizes.length - 1) continue;
        const x = PAD.left + (i / denom) * plotW;
        ctx.fillText(fmtN(sizes[i]), x, H - PAD.bottom + 18);
    }

    ctx.fillStyle = '#ccc';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Sort Time (ms, log scale) vs Element Count', W / 2, 18);

    // One polyline per config in BENCH_CONFIGS order, so colors line up with
    // the summary table's column order.
    for (let c = 0; c < BENCH_CONFIGS.length; c++) {
        const label = BENCH_CONFIGS[c].label;
        const color = COLORS[c % COLORS.length];
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        /** @type {{x: number, y: number}[]} */
        const points = [];
        for (let i = 0; i < sizes.length; i++) {
            const cell = bySize.get(sizes[i])?.get(label);
            if (!cell) continue;
            const x = PAD.left + (i / denom) * plotW;
            points.push({ x, y: yOf(cell.frameMs) });
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

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    for (let c = 0; c < BENCH_CONFIGS.length; c++) {
        const color = COLORS[c % COLORS.length];
        const lx = PAD.left + 10;
        const ly = PAD.top + 10 + c * 14;
        ctx.fillStyle = color;
        ctx.fillRect(lx, ly - 4, 10, 3);
        ctx.fillText(BENCH_CONFIGS[c].label, lx + 14, ly);
    }
}

/**
 * Build a plaintext copy of the benchmark results. With `includeDetails`
 * also appends the per-pass breakdown below the summary table, so the
 * output is suitable for pasting into a PR/issue or saving to disk.
 *
 * @param {{size: number, configLabel: string, frameMs: number, passMs: Map<string, number>}[]} results - Benchmark results.
 * @param {boolean} [includeDetails] - When true, append per-pass breakdown per (size, config).
 * @returns {string} Plaintext report.
 */
function benchResultsPlaintext(results, includeDetails = false) {
    /** @type {Map<number, Map<string, {frameMs: number, passMs: Map<string, number>}>>} */
    const bySize = new Map();
    for (const r of results) {
        let row = bySize.get(r.size);
        if (!row) {
            row = new Map();
            bySize.set(r.size, row);
        }
        row.set(r.configLabel, { frameMs: r.frameMs, passMs: r.passMs });
    }
    const sizes = [...bySize.keys()].sort((a, b) => a - b);

    const gpuLine = buildGpuLine('-');

    const COL_W = 14;
    const baseline = BENCH_CONFIGS[0].label;

    let text = 'Radix Sort Benchmark\n';
    text += `${gpuLine}\n`;
    text += `${BENCH_BITS}-bit keys, ${BENCH_WARMUP} warmup + ${BENCH_MEASURE} measured frames per cell\n`;
    text += 'Sort-only GPU time in ms (Forward pass excluded)\n';
    text += `Captured: ${new Date().toISOString()}\n\n`;

    // Header row: Size + for each config: its label + (if non-baseline) a
    // "vs baseline" column.
    text += 'Size'.padStart(8);
    for (let c = 0; c < BENCH_CONFIGS.length; c++) {
        text += BENCH_CONFIGS[c].label.padStart(COL_W);
        if (c > 0) text += `vs ${baseline}`.padStart(COL_W);
    }
    text += '\n';
    const totalW = 8 + BENCH_CONFIGS.length * COL_W + (BENCH_CONFIGS.length - 1) * COL_W;
    text += '-'.repeat(totalW);
    text += '\n';

    for (const size of sizes) {
        const row = bySize.get(size);
        if (!row) continue;
        text += fmtN(size).padStart(8);
        const b = row.get(baseline)?.frameMs ?? 0;
        for (let c = 0; c < BENCH_CONFIGS.length; c++) {
            const cfg = BENCH_CONFIGS[c];
            const v = row.get(cfg.label)?.frameMs ?? 0;
            text += (v ? v.toFixed(2) : '-').padStart(COL_W);
            if (c > 0) {
                text += (b > 0 && v > 0 ? `${(b / v).toFixed(2)}x` : '-').padStart(COL_W);
            }
        }
        text += '\n';
    }

    if (includeDetails) {
        text += '\n\nPer-pass breakdown (mean ms)\n';
        text += '='.repeat(totalW);
        text += '\n';
        for (const size of sizes) {
            const row = bySize.get(size);
            if (!row) continue;
            text += `\n[${fmtN(size)}]\n`;
            for (const cfg of BENCH_CONFIGS) {
                const entry = row.get(cfg.label);
                if (!entry) continue;
                text += `  ${cfg.label}  (sort-only ${entry.frameMs.toFixed(3)} ms)\n`;
                const passes = [...entry.passMs.entries()].sort((a, b) => b[1] - a[1]);
                if (passes.length === 0) {
                    text += '    (no pass timings)\n';
                } else {
                    for (const [name, t] of passes) {
                        text += `    ${t.toFixed(3).padStart(8)}  ${name}\n`;
                    }
                }
            }
        }
    }

    return text;
}

/**
 * Trigger a text file download in the browser.
 *
 * @param {string} filename - Suggested filename.
 * @param {string} content - File contents.
 */
function downloadText(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Defer revoke so the download has a chance to start in all browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Build a filename for the saved report: radix-bench-<device>-<YYYYMMDD-HHMMSS>.txt.
 *
 * @returns {string} The suggested filename.
 */
function benchFilename() {
    const dev = /** @type {any} */ (device);
    let tag = device.deviceType || 'gpu';
    if (device.isWebGPU && dev.gpuAdapter?.info) {
        const info = dev.gpuAdapter.info;
        tag = (info.architecture || info.device || info.vendor || 'gpu');
    }
    tag = String(tag).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const d = new Date();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `radix-bench-${tag}-${stamp}.txt`;
}

// ==================== VALIDATION ====================

// Validation exercises every mode listed in BENCH_CONFIGS against a CPU
// reference sort. Unlike the benchmark it ignores timing entirely and only
// reports pass/fail. The size sweep and mode list are shared with the
// benchmark so selecting a `Run up to` value applies to both buttons.
const VALIDATE_RUNS = 10;

// True while an async validation pass is in flight. Gates the normal
// per-frame sort to prevent the interactive path from clobbering the
// validate driver's sort instances and readbacks.
let validateRunning = false;

/**
 * Fill a Uint32Array with random 24-bit keys. Returned separately from the
 * uploaded GPU buffer so the CPU reference sort can reuse the same data.
 *
 * @param {number} numElements - Number of elements.
 * @returns {Uint32Array} Random keys.
 */
function generateValidateKeys(numElements) {
    const maxValue = (1 << BENCH_BITS) - 1;
    const data = new Uint32Array(numElements);
    for (let i = 0; i < numElements; i++) {
        data[i] = Math.floor(Math.random() * maxValue);
    }
    return data;
}

/**
 * Compare GPU-produced sorted indices against a CPU-sorted reference.
 *
 * @param {Uint32Array} indices - GPU-produced sorted indices.
 * @param {Uint32Array} original - Original unsorted keys (pre-sort).
 * @param {Uint32Array} cpuSorted - CPU-sorted reference keys.
 * @returns {{i: number, gpu: number, expected: number}|null} First mismatch or null if all match.
 */
function findFirstMismatch(indices, original, cpuSorted) {
    const n = indices.length;
    for (let i = 0; i < n; i++) {
        const gpu = original[indices[i]];
        const expected = cpuSorted[i];
        if (gpu !== expected) {
            return { i: i, gpu: gpu, expected: expected };
        }
    }
    return null;
}

/**
 * @typedef {{ passed: number, failed: number, skipped: boolean, firstFailure: { run: number, i: number, gpu: number, expected: number } | null }} ValidateCell
 */

/**
 * Run the full validation sweep. Iterates size → run → mode; generates a
 * single random input per (size, run) so every mode sees identical data
 * (direct A/B reproduction for any mismatch). Any mode that produces an
 * incorrect result at size N is marked `skipped` for all larger sizes.
 *
 * @returns {Promise<void>} Resolves when the sweep completes.
 */
async function runValidation() {
    if (validateRunning || benchState) return;

    const maxN = /** @type {number} */ (data.get('options.benchMaxElements') ?? 10_000_000);
    const sizes = BENCH_SIZES.filter(n => n <= maxN);
    if (sizes.length === 0) {
        showBenchStatus('No validation sizes selected.');
        setTimeout(() => {
            benchStatus.style.display = 'none';
        }, 1500);
        return;
    }

    // Snapshot the same interactive state the benchmark does so we can
    // leave the UI untouched after completion. Validation doesn't need the
    // GPU profiler, but we still disable visualization and the error
    // overlay to keep the screen clean.
    const saved = {
        elementsK: data.get('options.elementsK'),
        bits: data.get('options.bits'),
        mode: data.get('options.mode'),
        render: data.get('options.render'),
        validation: data.get('options.validation')
    };

    unsortedPlane.enabled = false;
    sortedPlane.enabled = false;
    errorOverlay.style.display = 'none';
    benchResults.style.display = 'none';

    validateRunning = true;

    /** @type {Map<string, ValidateCell>} */
    const results = new Map();
    /** @type {Set<string>} */
    const skipLabels = new Set();

    const key = (/** @type {number} */ size, /** @type {string} */ label) => `${size}:${label}`;

    try {
        for (const size of sizes) {
            // Pre-mark any already-failed mode as skipped for this size so
            // it appears in the output grid even though we don't run it.
            for (const cfg of BENCH_CONFIGS) {
                if (skipLabels.has(cfg.label)) {
                    results.set(key(size, cfg.label), {
                        passed: 0, failed: 0, skipped: true, firstFailure: null
                    });
                }
            }

            for (let run = 0; run < VALIDATE_RUNS; run++) {
                // Fresh random input per run; shared across all configs at
                // this (size, run) so mismatches can be directly compared.
                const keysCpu = generateValidateKeys(size);
                const cpuSorted = keysCpu.slice().sort();
                const keysBuf = new pc.StorageBuffer(
                    device,
                    size * 4,
                    pc.BUFFERUSAGE_COPY_SRC | pc.BUFFERUSAGE_COPY_DST
                );
                keysBuf.write(0, keysCpu);

                for (const cfg of BENCH_CONFIGS) {
                    if (skipLabels.has(cfg.label)) continue;

                    showBenchStatus(
                        `Validating [${cfg.label}]  ${fmtN(size)}  run ${run + 1}/${VALIDATE_RUNS}`
                    );

                    const sort = createBenchSort(cfg.modeKey);
                    const alignedBits = Math.ceil(BENCH_BITS / sort.radixBits) * sort.radixBits;
                    sort.sort(keysBuf, size, alignedBits);

                    const indicesData = new Uint32Array(size);
                    // eslint-disable-next-line no-await-in-loop
                    await sort.sortedIndices.read(0, size * 4, indicesData, true);

                    const mismatch = findFirstMismatch(indicesData, keysCpu, cpuSorted);

                    const k = key(size, cfg.label);
                    let entry = results.get(k);
                    if (!entry) {
                        entry = { passed: 0, failed: 0, skipped: false, firstFailure: null };
                        results.set(k, entry);
                    }
                    if (mismatch) {
                        entry.failed++;
                        if (!entry.firstFailure) {
                            entry.firstFailure = { run: run, ...mismatch };
                        }
                        // Fail-fast per mode: the next size will almost
                        // certainly fail too, and each failure eats a long
                        // readback. Skip this mode at all larger sizes.
                        skipLabels.add(cfg.label);
                    } else {
                        entry.passed++;
                    }

                    sort.destroy();

                    // Yield a frame so the engine can flush the GPU queue
                    // between sorts and the status overlay updates live.
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((resolve) => {
                        requestAnimationFrame(() => resolve(undefined));
                    });
                }

                keysBuf.destroy();
            }
        }
    } finally {
        validateRunning = false;
    }

    benchStatus.style.display = 'none';
    deviceInfo.style.display = 'none';

    renderValidateResults(results, sizes, () => {
        deviceInfo.style.display = '';
        data.set('options.elementsK', saved.elementsK);
        data.set('options.bits', saved.bits);
        data.set('options.mode', saved.mode);
        data.set('options.render', saved.render);
        data.set('options.validation', saved.validation);
    });
    console.log(validateResultsPlaintext(results, sizes));
}

/**
 * Render the validation pass/fail grid into the `benchResults` overlay.
 *
 * @param {Map<string, ValidateCell>} results - Validation results.
 * @param {number[]} sizes - Sizes tested (sorted ascending).
 * @param {() => void} onClose - Called when the user clicks Close.
 */
function renderValidateResults(results, sizes, onClose) {
    const gpuLine = buildGpuLine('·');

    let html = '';
    html += '<div style="font-size:16px;font-weight:bold;margin-bottom:6px;color:#fff;">Radix Sort Validation</div>';
    html += `<div style="opacity:0.8;margin-bottom:4px;color:#fff;">${gpuLine}</div>`;
    html += `<div style="opacity:0.8;margin-bottom:14px;color:#fff;">${BENCH_BITS}-bit keys · ${VALIDATE_RUNS} runs per cell · no timing</div>`;

    html += '<table style="border-collapse:collapse;width:100%;color:#fff;">';
    html += '<thead><tr>';
    html += '<th style="text-align:left;padding:6px 10px;border-bottom:1px solid #444;">Size</th>';
    for (const cfg of BENCH_CONFIGS) {
        html += `<th style="text-align:left;padding:6px 10px;border-bottom:1px solid #444;">${cfg.label}</th>`;
    }
    html += '<th style="text-align:left;padding:6px 10px;border-bottom:1px solid #444;">Details</th>';
    html += '</tr></thead><tbody>';

    /** @type {{size: number, label: string, entry: ValidateCell}[]} */
    const detailRows = [];

    for (const size of sizes) {
        html += '<tr>';
        html += `<td style="padding:4px 10px;">${fmtN(size)}</td>`;
        let rowHasDetails = false;
        for (const cfg of BENCH_CONFIGS) {
            const entry = results.get(`${size}:${cfg.label}`);
            if (!entry) {
                html += '<td style="padding:4px 10px;color:#888;">--</td>';
                continue;
            }
            if (entry.skipped) {
                html += '<td style="padding:4px 10px;color:#888;">skip</td>';
            } else if (entry.failed > 0) {
                html += `<td style="padding:4px 10px;color:#f66;font-weight:bold;">FAIL ${entry.failed}/${VALIDATE_RUNS}</td>`;
                rowHasDetails = true;
            } else {
                html += `<td style="padding:4px 10px;color:#6f6;">PASS ${entry.passed}/${VALIDATE_RUNS}</td>`;
            }
        }

        if (rowHasDetails) {
            const detailIdx = detailRows.length;
            html += `<td style="padding:4px 10px;"><button data-toggle="${detailIdx}" style="background:#333;color:#fff;border:1px solid #555;cursor:pointer;border-radius:3px;">▸</button></td>`;
            for (const cfg of BENCH_CONFIGS) {
                const entry = results.get(`${size}:${cfg.label}`);
                if (entry && entry.failed > 0) {
                    detailRows.push({ size: size, label: cfg.label, entry: entry });
                }
            }
        } else {
            html += '<td style="padding:4px 10px;color:#888;">--</td>';
        }
        html += '</tr>';

        // Insert hidden detail row immediately under each failing size.
        // The hidden row's id must match the toggle button's
        // `data-toggle` set earlier (which captured `detailRows.length`
        // BEFORE pushing this size's failures, i.e. the start index).
        if (rowHasDetails) {
            const startIdx = detailRows.findIndex(r => r.size === size);
            const lastIdx = detailRows.length - 1;
            let detailHtml = '';
            for (let d = startIdx; d <= lastIdx; d++) {
                const r = detailRows[d];
                const f = /** @type {NonNullable<ValidateCell['firstFailure']>} */ (r.entry.firstFailure);
                detailHtml += `<div style="margin:3px 0;"><span style="color:#f66;">${r.label}</span>: `;
                detailHtml += `${r.entry.failed}/${VALIDATE_RUNS} runs failed. First mismatch @ run ${f.run + 1}, `;
                detailHtml += `index ${f.i}: GPU=${f.gpu}, expected=${f.expected}</div>`;
            }
            html += `<tr data-detail-content="${startIdx}" style="display:none;"><td colspan="${BENCH_CONFIGS.length + 2}" style="padding:8px 10px 10px 20px;background:rgba(255,255,255,0.04);font-size:12px;">${detailHtml}</td></tr>`;
        }
    }

    html += '</tbody></table>';

    html += '<div style="margin-top:14px;display:flex;gap:8px;">';
    html += '<button id="validate-save" style="background:#2a6;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;">Save to file</button>';
    html += '<button id="validate-close" style="background:#48a;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;">Close</button>';
    html += '</div>';

    benchResults.innerHTML = html;
    benchResults.style.display = 'block';

    // Wire toggle buttons.
    const toggles = benchResults.querySelectorAll('button[data-toggle]');
    toggles.forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = btn.getAttribute('data-toggle');
            const row = /** @type {HTMLElement|null} */ (
                benchResults.querySelector(`tr[data-detail-content="${idx}"]`)
            );
            if (row) {
                const show = row.style.display === 'none';
                row.style.display = show ? 'table-row' : 'none';
                btn.textContent = show ? '▾' : '▸';
            }
        });
    });

    const saveBtn = benchResults.querySelector('#validate-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            downloadText(validateFilename(), validateResultsPlaintext(results, sizes));
        });
    }

    const closeBtn = benchResults.querySelector('#validate-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            benchResults.style.display = 'none';
            onClose();
        });
    }
}

/**
 * Plain-text version of the validation report, suitable for console and
 * file output.
 *
 * @param {Map<string, ValidateCell>} results - Validation results.
 * @param {number[]} sizes - Sizes tested.
 * @returns {string} Plain text report.
 */
function validateResultsPlaintext(results, sizes) {
    const gpuLine = buildGpuLine('-');

    let text = 'Radix Sort Validation\n';
    text += `${gpuLine}\n`;
    text += `${BENCH_BITS}-bit keys, ${VALIDATE_RUNS} runs per cell, no timing\n`;
    text += `Captured: ${new Date().toISOString()}\n\n`;

    const COL_W = 16;
    text += 'Size'.padEnd(8);
    for (const cfg of BENCH_CONFIGS) {
        text += cfg.label.padStart(COL_W);
    }
    text += '\n';
    text += `${'-'.repeat(8 + BENCH_CONFIGS.length * COL_W)}\n`;

    for (const size of sizes) {
        text += fmtN(size).padEnd(8);
        for (const cfg of BENCH_CONFIGS) {
            const entry = results.get(`${size}:${cfg.label}`);
            let cell;
            if (!entry) {
                cell = '--';
            } else if (entry.skipped) {
                cell = 'skip';
            } else if (entry.failed > 0) {
                cell = `FAIL ${entry.failed}/${VALIDATE_RUNS}`;
            } else {
                cell = `PASS ${entry.passed}/${VALIDATE_RUNS}`;
            }
            text += cell.padStart(COL_W);
        }
        text += '\n';
    }

    // Failure detail section: one block per (size, mode) with at least one failure.
    let hasFailures = false;
    for (const [, entry] of results) {
        if (entry.failed > 0) {
            hasFailures = true;
            break;
        }
    }

    if (hasFailures) {
        text += '\n\nFailure details\n';
        text += `${'='.repeat(8 + BENCH_CONFIGS.length * COL_W)}\n\n`;
        for (const size of sizes) {
            for (const cfg of BENCH_CONFIGS) {
                const entry = results.get(`${size}:${cfg.label}`);
                if (entry && entry.failed > 0 && entry.firstFailure) {
                    const f = entry.firstFailure;
                    text += `[${fmtN(size)}]  ${cfg.label}\n`;
                    text += `    ${entry.failed}/${VALIDATE_RUNS} runs failed\n`;
                    text += `    first mismatch: run ${f.run + 1}, index ${f.i}, GPU=${f.gpu}, expected=${f.expected}\n\n`;
                }
            }
        }
    }

    return text;
}

/**
 * Build a filename for the saved validation report.
 *
 * @returns {string} The suggested filename.
 */
function validateFilename() {
    const dev = /** @type {any} */ (device);
    let tag = device.deviceType || 'gpu';
    if (device.isWebGPU && dev.gpuAdapter?.info) {
        const info = dev.gpuAdapter.info;
        tag = (info.architecture || info.device || info.vendor || 'gpu');
    }
    tag = String(tag).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const d = new Date();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `radix-validate-${tag}-${stamp}.txt`;
}

// Hook the button-emitted event from the controls panel.
data.on('benchmark', () => {
    startBenchmark();
});

data.on('validate', () => {
    runValidation();
});

// Update loop - continuously sorts every frame
app.on('update', (/** @type {number} */ dt) => {
    // Rotate the cube for visual frame rate indication
    cube.rotate(10 * dt, 20 * dt, 30 * dt);

    // Benchmark mode takes over the frame: it owns its own sort instances
    // and keys buffer, and intentionally bypasses the interactive material
    // updates so fragment-shader work doesn't contaminate timings.
    if (benchState) {
        stepBenchmark();
        return;
    }

    // Validation drives its own sort dispatches from an async driver and
    // must not be clobbered by the interactive per-frame sort.
    if (validateRunning) {
        return;
    }

    // Wait for observer to initialize values from controls
    if (currentNumElements === 0 || currentNumBits === 0) {
        return;
    }

    // Regenerate data when parameters change. Validation is a one-shot
    // GPU→CPU readback + CPU reference sort, which is O(N log N) on the
    // main thread and blocks for seconds at large N. Gate it behind the
    // Validation toggle so perf testing with frequent slider tweaks stays
    // responsive.
    const verify = needsRegen && (data.get('options.validation') ?? true);
    if (needsRegen) {
        regenerateData();
    }

    // Sort every frame, verify only after regeneration (and only when the
    // Validation toggle is on).
    runSort(verify);

    // Toggle visualization planes based on the Render checkbox. Disabling
    // rendering isolates pure sort cost (no quad draws, no texture sampling
    // of the keys/indices buffers).
    const renderEnabled = data.get('options.render') ?? true;
    if (unsortedPlane.enabled !== renderEnabled) {
        unsortedPlane.enabled = renderEnabled;
        sortedPlane.enabled = renderEnabled;
    }
});

export { app };
