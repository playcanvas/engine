// @config DESCRIPTION Test example for ComputeRadixSort.sortIndirect - validates indirect GPU radix sort
// @config WEBGL_DISABLED
// @config HIDDEN
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

// Status overlay
const statusOverlay = document.createElement('div');
statusOverlay.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    font-family: monospace;
    font-size: 13px;
    color: #ccc;
    background: rgba(0, 0, 0, 0.8);
    padding: 12px;
    border-radius: 4px;
    z-index: 1000;
    white-space: pre-wrap;
    max-height: 90vh;
    overflow-y: auto;
`;
statusOverlay.textContent = `Device: ${device.deviceType.toUpperCase()}\nInitializing...`;
document.body.appendChild(statusOverlay);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [pc.CameraComponentSystem];
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

// Camera (required for app to render)
const camera = new pc.Entity('camera');
camera.addComponent('camera', { clearColor: new pc.Color(0.1, 0.1, 0.15) });
camera.setPosition(0, 0, 1);
app.root.addChild(camera);

// ==================== STATE ====================

/** @type {number} */
let currentMaxElements = 0;
/** @type {number} */
let currentNumBits = 0;
/** @type {pc.StorageBuffer|null} */
let keysBuffer = null;
/** @type {pc.ComputeRadixSort|null} */
let radixSort = null;
/** @type {pc.StorageBuffer|null} */
let sortElementCountBuffer = null;
/** @type {number[]} */
let originalValues = [];
/** @type {boolean} */
let needsRegen = true;
/** @type {boolean} */
let verificationPending = false;

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
let logLines = [];

function log(msg) {
    console.log(msg);
    logLines.push(msg);
    if (logLines.length > 40) logLines.shift();
    statusOverlay.textContent = logLines.join('\n');
}

function logError(msg) {
    console.error(msg);
    logLines.push(`ERROR: ${msg}`);
    if (logLines.length > 40) logLines.shift();
    statusOverlay.textContent = logLines.join('\n');
}

// Create radix sort instance
radixSort = new pc.ComputeRadixSort(device);

// Create sortElementCount buffer (single u32, GPU-readable storage buffer)
sortElementCountBuffer = new pc.StorageBuffer(device, 4, pc.BUFFERUSAGE_COPY_SRC | pc.BUFFERUSAGE_COPY_DST);

// ==================== PREPARE-INDIRECT COMPUTE SHADER ====================
// Simulates the GSplat pipeline's prepareIndirect: a compute shader writes
// sortElementCount and indirect dispatch args within the command buffer
// (instead of queue.writeBuffer which executes before the command buffer).

const prepareSource = /* wgsl */`
    @group(0) @binding(0) var<storage, read_write> sortElementCountBuf: array<u32>;
    @group(0) @binding(1) var<storage, read_write> indirectDispatchArgs: array<u32>;
    struct PrepareUniforms {
        visibleCount: u32,
        dispatchSlotOffset: u32
    };
    @group(0) @binding(2) var<uniform> uniforms: PrepareUniforms;

    @compute @workgroup_size(1)
    fn main() {
        let count = uniforms.visibleCount;
        sortElementCountBuf[0] = count;

        let sortWorkgroupCount = (count + 255u) / 256u;
        let offset = uniforms.dispatchSlotOffset;
        indirectDispatchArgs[offset + 0u] = sortWorkgroupCount;
        indirectDispatchArgs[offset + 1u] = 1u;
        indirectDispatchArgs[offset + 2u] = 1u;
    }
`;

const prepareUniformFormat = new pc.UniformBufferFormat(device, [
    new pc.UniformFormat('visibleCount', pc.UNIFORMTYPE_UINT),
    new pc.UniformFormat('dispatchSlotOffset', pc.UNIFORMTYPE_UINT)
]);

const prepareBindGroupFormat = new pc.BindGroupFormat(device, [
    new pc.BindStorageBufferFormat('sortElementCountBuf', pc.SHADERSTAGE_COMPUTE, false),
    new pc.BindStorageBufferFormat('indirectDispatchArgs', pc.SHADERSTAGE_COMPUTE, false),
    new pc.BindUniformBufferFormat('uniforms', pc.SHADERSTAGE_COMPUTE)
]);

const prepareShader = new pc.Shader(device, {
    name: 'PrepareIndirectTest',
    shaderLanguage: pc.SHADERLANGUAGE_WGSL,
    cshader: prepareSource,
    computeEntryPoint: 'main',
    computeBindGroupFormat: prepareBindGroupFormat,
    computeUniformBufferFormats: { uniforms: prepareUniformFormat }
});

const prepareCompute = new pc.Compute(device, prepareShader, 'PrepareIndirectTest');

// ==================== HELPER FUNCTIONS ====================

/**
 * Regenerates random key data.
 */
function regenerateData() {
    const maxElements = currentMaxElements;
    const numBits = currentNumBits;
    const maxValue = numBits >= 32 ? 0xFFFFFFFF : (1 << numBits) - 1;

    if (keysBuffer) {
        keysBuffer.destroy();
    }

    keysBuffer = new pc.StorageBuffer(device, maxElements * 4, pc.BUFFERUSAGE_COPY_SRC | pc.BUFFERUSAGE_COPY_DST);

    const keysData = new Uint32Array(maxElements);
    originalValues = [];

    for (let i = 0; i < maxElements; i++) {
        const value = Math.floor(Math.random() * maxValue);
        keysData[i] = value;
        originalValues.push(value);
    }

    keysBuffer.write(0, keysData);
    needsRegen = false;
}

/**
 * Verifies the indirect sort results against CPU reference.
 *
 * @param {pc.StorageBuffer} sortedIndices - Sorted indices buffer.
 * @param {number[]} capturedValues - Copy of original key values.
 * @param {number} maxElements - Total element count.
 * @param {number} visibleCount - Number of elements that were sorted.
 * @param {number} numBits - Number of bits used for sorting.
 */
async function doVerification(sortedIndices, capturedValues, maxElements, visibleCount, numBits) {
    totalTests++;

    // Read back sorted indices (only visibleCount entries matter)
    const indicesData = new Uint32Array(visibleCount);
    await sortedIndices.read(0, visibleCount * 4, indicesData, true);

    // Check 1: All indices in range [0, visibleCount)
    let outOfRangeCount = 0;
    for (let i = 0; i < visibleCount; i++) {
        if (indicesData[i] >= visibleCount) {
            outOfRangeCount++;
            if (outOfRangeCount <= 3) {
                logError(`  Out-of-range index at [${i}]: ${indicesData[i]} >= ${visibleCount}`);
            }
        }
    }

    // Check 2: No duplicate indices (valid permutation)
    const seen = new Uint8Array(visibleCount);
    let duplicateCount = 0;
    let missingCount = 0;
    for (let i = 0; i < visibleCount; i++) {
        const idx = indicesData[i];
        if (idx < visibleCount) {
            if (seen[idx]) {
                duplicateCount++;
                if (duplicateCount <= 3) {
                    logError(`  Duplicate index ${idx} at position ${i}`);
                }
            }
            seen[idx] = 1;
        }
    }
    for (let i = 0; i < visibleCount; i++) {
        if (!seen[i]) {
            missingCount++;
            if (missingCount <= 3) {
                logError(`  Missing index ${i} from sorted output`);
            }
        }
    }

    // Check 3: Values are in sorted order
    let orderErrors = 0;
    const sortedValues = [];
    for (let i = 0; i < visibleCount; i++) {
        const idx = indicesData[i];
        sortedValues.push(idx < capturedValues.length ? capturedValues[idx] : 0xFFFFFFFF);
    }
    for (let i = 1; i < visibleCount; i++) {
        if (sortedValues[i] < sortedValues[i - 1]) {
            orderErrors++;
            if (orderErrors <= 3) {
                logError(`  Order error at [${i}]: ${sortedValues[i]} < ${sortedValues[i - 1]}`);
            }
        }
    }

    // CPU reference sort for value comparison
    const cpuSorted = capturedValues.slice(0, visibleCount).sort((a, b) => a - b);
    let valueMismatches = 0;
    for (let i = 0; i < visibleCount; i++) {
        if (sortedValues[i] !== cpuSorted[i]) {
            valueMismatches++;
        }
    }

    const passed = outOfRangeCount === 0 && duplicateCount === 0 && missingCount === 0 && orderErrors === 0 && valueMismatches === 0;

    if (passed) {
        totalPassed++;
        log(`✓ Test ${totalTests}: sortIndirect OK — ${visibleCount}/${maxElements} elements, ${numBits} bits (${totalPassed} passed, ${totalFailed} failed)`);
    } else {
        totalFailed++;
        logError(`✗ Test ${totalTests}: sortIndirect FAILED — ${visibleCount}/${maxElements} elements, ${numBits} bits`);
        logError(`  outOfRange=${outOfRangeCount} duplicates=${duplicateCount} missing=${missingCount} orderErrors=${orderErrors} valueMismatches=${valueMismatches}`);
        logError(`  (${totalPassed} passed, ${totalFailed} failed)`);
    }
}

// ==================== CONTROLS ====================

data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    if (path === 'options.elementsK') {
        const newElements = value * 1000;
        if (newElements !== currentMaxElements) {
            currentMaxElements = newElements;
            needsRegen = true;
        }
    } else if (path === 'options.bits') {
        const validBits = [4, 8, 12, 16, 20, 24, 28, 32];
        const nearest = validBits.reduce((prev, curr) => (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev));
        if (nearest !== currentNumBits) {
            currentNumBits = nearest;
            needsRegen = true;
        }
    }
});

// Initialize with defaults
data.set('options', {
    elementsK: 1000,
    bits: 16
});

// ==================== UPDATE LOOP ====================
// Simulate the GSplat pipeline: same keys buffer, but visibleCount changes every frame
// (like camera rotation changing the culled set). This tests whether sortIndirect's
// internal state (ping-pong buffers, block sums) handles varying counts correctly.

let frameCount = 0;
let varyingVisibleCount = 0;

app.on('update', () => {
    if (currentMaxElements === 0 || currentNumBits === 0) return;

    // Regenerate data only when parameters change
    if (needsRegen) {
        regenerateData();
    }

    // Vary visible count every frame using a sine wave (simulates camera rotation)
    // Oscillates between 10% and 90% of maxElements
    frameCount++;
    const t = frameCount * 0.05; // ~3 second full cycle at 60fps
    const minPercent = 10;
    const maxPercent = 90;
    const percent = minPercent + (maxPercent - minPercent) * (0.5 + 0.5 * Math.sin(t));
    varyingVisibleCount = Math.max(1, Math.floor(currentMaxElements * percent / 100));

    // Override the visible count for this frame (don't use currentVisiblePercent)
    const maxElements = currentMaxElements;
    const visibleCount = varyingVisibleCount;
    const numBits = currentNumBits;

    if (!keysBuffer || !radixSort || !sortElementCountBuffer) return;

    // Allocate per-frame indirect dispatch slot
    const dispatchSlot = device.getIndirectDispatchSlot(1);

    // Write sortElementCount and dispatch args via compute shader
    const dispatchBuffer = device.indirectDispatchBuffer;
    const slotOffset = dispatchSlot * 3;

    prepareCompute.setParameter('sortElementCountBuf', sortElementCountBuffer);
    prepareCompute.setParameter('indirectDispatchArgs', dispatchBuffer);
    prepareCompute.setParameter('visibleCount', visibleCount);
    prepareCompute.setParameter('dispatchSlotOffset', slotOffset);
    prepareCompute.setupDispatch(1, 1, 1);
    device.computeDispatch([prepareCompute], 'PrepareIndirectTest');

    // Run indirect sort with varying visible count
    const sortedIndicesBuffer = radixSort.sortIndirect(
        keysBuffer, maxElements, numBits, dispatchSlot, sortElementCountBuffer
    );

    // Verify every 10 frames to catch intermittent failures without overwhelming readbacks
    if (frameCount % 10 === 0 && !verificationPending) {
        verificationPending = true;
        doVerification(sortedIndicesBuffer, originalValues.slice(), maxElements, visibleCount, numBits)
            .then(() => {
                verificationPending = false;
            });
    }
});

export { app };
