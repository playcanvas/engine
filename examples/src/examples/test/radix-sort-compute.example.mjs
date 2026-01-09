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
deviceInfo.textContent = `Device: ${device.deviceType.toUpperCase()}`;
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
/** @type {pc.ComputeRadixSort|null} */
let radixSort = null;
/** @type {pc.StorageBuffer|null} */
let sortedIndicesBuffer = null;
/** @type {number[]} */
let originalValues = [];
/** @type {boolean} */
let needsRegen = true;
/** @type {boolean} */
const enableRendering = true;

// Create compute radix sort instance

radixSort = new pc.ComputeRadixSort(device);

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
    if (!keysBuffer || !radixSort) return;

    // Execute the GPU sort and get the sorted indices buffer
    sortedIndicesBuffer = radixSort.sort(keysBuffer, currentNumElements, currentNumBits);

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

    // Compare GPU result against CPU reference
    let errorCount = 0;
    for (let i = 0; i < capturedNumElements; i++) {
        if (sortedValues[i] !== cpuSorted[i]) {
            if (errorCount < 5) {
                console.error(`Mismatch at index ${i}: GPU=${sortedValues[i]}, expected=${cpuSorted[i]}`);
            }
            errorCount++;
        }
    }

    if (errorCount > 0) {
        sortFailureCount++;
        console.error(`✗ [${device.deviceType}] Array is NOT correctly sorted (${errorCount} errors, ${(errorCount / capturedNumElements * 100).toFixed(2)}%)`);
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
        // Round to nearest valid value (must be multiple of 4)
        const validBits = [4, 8, 12, 16, 20, 24, 28, 32];
        const nearest = validBits.reduce((prev, curr) => (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev)
        );
        if (nearest !== currentNumBits) {
            currentNumBits = nearest;
            needsRegen = true;
        }
    }
});

// Initialize observer with default values (single source of truth for defaults)
// Must be after data.on() so the handler receives the initial values
data.set('options', {
    elementsK: 1000,
    bits: 16
});

// Update loop - continuously sorts every frame
app.on('update', (/** @type {number} */ dt) => {
    // Rotate the cube for visual frame rate indication
    cube.rotate(10 * dt, 20 * dt, 30 * dt);

    // Wait for observer to initialize values from controls
    if (currentNumElements === 0 || currentNumBits === 0) {
        return;
    }

    // Regenerate data when parameters change
    const verify = needsRegen;
    if (needsRegen) {
        regenerateData();
    }

    // Sort every frame, verify only after regeneration
    runSort(verify);

    // Enable visualization after first sort
    if (enableRendering && !unsortedPlane.enabled) {
        unsortedPlane.enabled = true;
        sortedPlane.enabled = true;
    }
});

export { app };
