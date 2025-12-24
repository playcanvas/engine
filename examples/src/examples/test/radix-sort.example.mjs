// @config DESCRIPTION Test example for RenderPassRadixSort - GPU radix sort using mipmap binary search
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
/** @type {{sortedIndices: pc.Texture, originalValues: number[], numElements: number}|null} */
let pendingVerification = null;

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

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
/** @type {pc.Texture|null} */
let keysTexture = null;
/** @type {pc.RenderPassRadixSort|null} */
let radixSort = null;
/** @type {number[]} */
let originalValues = [];
/** @type {boolean} */
let needsRegen = true;

// Create render pass instance once
// eslint-disable-next-line import/namespace
radixSort = new pc.RenderPassRadixSort(device);

// ==================== MATERIALS ====================

// Create unsorted visualization material
const unsortedMaterial = new pc.ShaderMaterial({
    uniqueName: 'UnsortedVizMaterial',
    vertexGLSL: files['vert.glsl'],
    fragmentGLSL: files['unsorted.glsl.frag'],
    vertexWGSL: files['vert.wgsl'],
    fragmentWGSL: files['unsorted.wgsl.frag'],
    attributes: {
        aPosition: pc.SEMANTIC_POSITION,
        aUv0: pc.SEMANTIC_TEXCOORD0
    }
});

// Create sorted visualization material
const sortedMaterial = new pc.ShaderMaterial({
    uniqueName: 'SortedVizMaterial',
    vertexGLSL: files['vert.glsl'],
    fragmentGLSL: files['sorted.glsl.frag'],
    vertexWGSL: files['vert.wgsl'],
    fragmentWGSL: files['sorted.wgsl.frag'],
    attributes: {
        aPosition: pc.SEMANTIC_POSITION,
        aUv0: pc.SEMANTIC_TEXCOORD0
    }
});

// ==================== SCENE SETUP ====================

// Create camera entity
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.1, 0.1),
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
 * Recreates the keys texture and generates random data.
 */
function regenerateData() {
    const numElements = currentNumElements;
    const numBits = currentNumBits;
    const maxValue = (1 << numBits) - 1;

    // Calculate non-POT texture size
    const { width, height } = calcTextureSize(numElements);

    // Destroy old texture
    if (keysTexture) {
        keysTexture.destroy();
    }

    // Create new source keys texture
    keysTexture = new pc.Texture(device, {
        name: 'SourceKeys',
        width: width,
        height: height,
        format: pc.PIXELFORMAT_R32U,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    // Generate random test data directly into texture (linear layout)
    const texData = keysTexture.lock();

    // also keep original values for verification
    originalValues = [];

    for (let i = 0; i < numElements; i++) {
        const value = Math.floor(Math.random() * maxValue);
        texData[i] = value;
        originalValues.push(value);
    }

    // Note: No need to initialize padding - the shader ignores elements past elementCount

    keysTexture.unlock();

    needsRegen = false;
}

/**
 * Runs the GPU sort.
 *
 * @param {boolean} [verify] - Whether to verify results.
 */
function runSort(verify = false) {
    if (!keysTexture || !radixSort) return;

    // Execute the GPU sort and get the sorted indices texture
    const sortedIndices = radixSort.sort(keysTexture, currentNumElements, currentNumBits);

    // Update materials with the sorted texture
    updateMaterialParameters(sortedIndices);

    // Verify results if requested
    if (verify) {
        verifyResults(sortedIndices);
    }
}

/**
 * Updates material parameters after sort completes or data changes.
 *
 * @param {pc.Texture} sortedIndices - The sorted indices texture.
 */
function updateMaterialParameters(sortedIndices) {
    if (!keysTexture || !sortedIndices) {
        return;
    }

    // Update unsorted material
    unsortedMaterial.setParameter('keysTexture', keysTexture);
    unsortedMaterial.setParameter('maxValue', (1 << currentNumBits) - 1);
    unsortedMaterial.setParameter('elementCount', currentNumElements);
    unsortedMaterial.setParameter('textureSize', [keysTexture.width, keysTexture.height]);
    unsortedMaterial.setParameter('debugMode', 0.0);
    unsortedMaterial.update();

    // Update sorted material
    sortedMaterial.setParameter('sortedIndices', sortedIndices);
    sortedMaterial.setParameter('keysTexture', keysTexture);
    sortedMaterial.setParameter('elementCount', currentNumElements);
    sortedMaterial.setParameter('textureWidth', sortedIndices.width);
    sortedMaterial.setParameter('maxValue', (1 << currentNumBits) - 1);
    sortedMaterial.setParameter('sourceTextureSize', [keysTexture.width, keysTexture.height]);
    sortedMaterial.setParameter('debugMode', 0.0);
    sortedMaterial.update();
}

/**
 * Downloads and verifies the sorted results against CPU-sorted reference.
 *
 * @param {pc.Texture} sortedIndices - The sorted indices texture to verify.
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
 * @param {pc.Texture} sortedIndices - The sorted indices texture.
 * @param {number[]} capturedOriginalValues - Copy of original values at sort time.
 * @param {number} capturedNumElements - Number of elements at sort time.
 */
async function doVerification(sortedIndices, capturedOriginalValues, capturedNumElements) {
    if (!sortedIndices) {
        console.error('No sorted indices texture available');
        errorOverlay.style.display = 'block';
        return;
    }

    const width = sortedIndices.width;

    // Read the sorted indices texture (R32U)
    const indicesResult = await sortedIndices.read(0, 0, width, width, {
        immediate: true
    });

    // Extract sorted indices (stored in linear order)
    const sortedIndicesArray = [];
    for (let i = 0; i < capturedNumElements; i++) {
        sortedIndicesArray.push(indicesResult[i]);
    }

    // Get sorted values by looking up original values (using captured copy)
    const sortedValues = sortedIndicesArray.map(idx => capturedOriginalValues[idx]);

    // CPU sort a copy of original values for reference
    const cpuSorted = capturedOriginalValues.slice().sort((a, b) => a - b);

    // Compare GPU result against CPU reference
    let errorCount = 0;
    for (let i = 0; i < capturedNumElements; i++) {
        if (sortedValues[i] !== cpuSorted[i]) {
            if (errorCount < 5) {
                console.error(`Mismatch at index ${i}: GPU=${sortedValues[i]}, expected=${cpuSorted[i]}, gpuIndex=${sortedIndicesArray[i]}`);
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
        if (value !== currentNumBits) {
            currentNumBits = value;
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
    if (!unsortedPlane.enabled) {
        unsortedPlane.enabled = true;
        sortedPlane.enabled = true;
    }
});

export { app };
