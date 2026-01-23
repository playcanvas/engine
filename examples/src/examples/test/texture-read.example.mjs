// @config DESCRIPTION Test example for texture.read() - verifies read/write roundtrip for 8-bit texture formats
// @config HIDDEN
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
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    font-family: Arial, sans-serif;
    font-size: 18px;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 1000;
`;
deviceInfo.textContent = `Device: ${device.deviceType.toUpperCase()}`;
document.body.appendChild(deviceInfo);

// Create result overlay (center)
const resultOverlay = document.createElement('div');
resultOverlay.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: Arial, sans-serif;
    font-size: 32px;
    font-weight: bold;
    padding: 24px 48px;
    border-radius: 12px;
    z-index: 1000;
    text-align: center;
`;
document.body.appendChild(resultOverlay);

// Create details overlay (below result)
const detailsOverlay = document.createElement('div');
detailsOverlay.style.cssText = `
    position: absolute;
    top: 65%;
    left: 50%;
    transform: translateX(-50%);
    font-family: monospace;
    font-size: 14px;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 1000;
    max-width: 80%;
    white-space: pre-wrap;
`;
document.body.appendChild(detailsOverlay);

// Test texture size
const TEX_WIDTH = 4;
const TEX_HEIGHT = 4;

// Define formats to test (normalized 8-bit formats only)
// Note: Integer formats (R8I, R8U, RG8I, RG8U) are excluded due to WebGL readPixels limitations
// Note: RG8S is excluded because it's not renderable in WebGPU (RG8Snorm doesn't support RenderAttachment)
const formatsToTest = [
    { format: pc.PIXELFORMAT_R8, name: 'R8', channels: 1, arrayType: Uint8Array },
    { format: pc.PIXELFORMAT_RG8, name: 'RG8', channels: 2, arrayType: Uint8Array },
    { format: pc.PIXELFORMAT_RGB8, name: 'RGB8', channels: 3, arrayType: Uint8Array },
    { format: pc.PIXELFORMAT_RGBA8, name: 'RGBA8', channels: 4, arrayType: Uint8Array }
];

/**
 * Generate test data for a texture.
 *
 * @param {number} width - Texture width.
 * @param {number} height - Texture height.
 * @param {number} channels - Number of channels.
 * @param {typeof Uint8Array} ArrayType - Array type to use.
 * @returns {Uint8Array} Test data.
 */
function generateTestData(width, height, channels, ArrayType) {
    const size = width * height * channels;
    const data = new ArrayType(size);

    // Fill with recognizable pattern (0-255 range)
    for (let i = 0; i < size; i++) {
        data[i] = (i * 17 + 31) % 256;
    }

    return data;
}

/**
 * Compare two arrays.
 *
 * @param {ArrayLike<number>} expected - Expected data.
 * @param {ArrayLike<number>} actual - Actual data.
 * @param {number} length - Number of elements to compare.
 * @returns {{match: boolean, firstMismatchIndex: number, expectedValue: number, actualValue: number}} Comparison result.
 */
function compareArrays(expected, actual, length) {
    for (let i = 0; i < length; i++) {
        if (expected[i] !== actual[i]) {
            return {
                match: false,
                firstMismatchIndex: i,
                expectedValue: expected[i],
                actualValue: actual[i]
            };
        }
    }
    return { match: true, firstMismatchIndex: -1, expectedValue: 0, actualValue: 0 };
}

/**
 * Test a single texture format.
 *
 * @param {{format: number, name: string, channels: number, arrayType: typeof Uint8Array}} formatInfo - Format info.
 * @returns {Promise<{name: string, passed: boolean, error?: string}>} Test result.
 */
async function testFormat(formatInfo) {
    const { format, name, channels, arrayType } = formatInfo;

    console.log(`Testing format: ${name}`);

    try {
        // Create texture
        const texture = new pc.Texture(device, {
            name: `Test_${name}`,
            width: TEX_WIDTH,
            height: TEX_HEIGHT,
            format: format,
            mipmaps: false,
            minFilter: pc.FILTER_NEAREST,
            magFilter: pc.FILTER_NEAREST,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });

        // Generate test data
        const expectedData = generateTestData(TEX_WIDTH, TEX_HEIGHT, channels, arrayType);
        const dataLength = TEX_WIDTH * TEX_HEIGHT * channels;

        // Lock, write data, unlock (which uploads)
        const lockedData = texture.lock();
        for (let i = 0; i < dataLength; i++) {
            lockedData[i] = expectedData[i];
        }
        texture.unlock();

        // Read back from GPU
        const readData = await texture.read(0, 0, TEX_WIDTH, TEX_HEIGHT, { immediate: true });

        // Compare
        const result = compareArrays(expectedData, readData, dataLength);

        // Cleanup
        texture.destroy();

        if (result.match) {
            console.log(`  ✓ ${name}: PASSED`);
            return { name, passed: true };
        }
        const error = `Mismatch at index ${result.firstMismatchIndex}: expected ${result.expectedValue}, got ${result.actualValue}`;
        console.error(`  ✗ ${name}: FAILED - ${error}`);
        return { name, passed: false, error };

    } catch (err) {
        const error = err.message || String(err);
        console.error(`  ✗ ${name}: ERROR - ${error}`);
        return { name, passed: false, error };
    }
}

/**
 * Run all texture format tests.
 */
async function runTests() {
    console.log('='.repeat(60));
    console.log(`Running texture.read() tests on ${device.deviceType.toUpperCase()}`);
    console.log('='.repeat(60));

    // Run tests sequentially to avoid resource conflicts
    /** @type {{name: string, passed: boolean, error?: string}[]} */
    const results = await formatsToTest.reduce(async (accPromise, formatInfo) => {
        const acc = await accPromise;
        const result = await testFormat(formatInfo);
        acc.push(result);
        return acc;
    }, Promise.resolve(/** @type {{name: string, passed: boolean, error?: string}[]} */([])));

    // Summary
    console.log('='.repeat(60));
    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);

    console.log(`Results: ${passed.length}/${results.length} passed`);

    if (failed.length === 0) {
        console.log('ALL TESTS PASSED');
        resultOverlay.textContent = 'ALL TESTS PASSED';
        resultOverlay.style.background = 'rgba(0, 128, 0, 0.9)';
        resultOverlay.style.color = 'white';
        detailsOverlay.textContent = `${passed.length} formats tested successfully:\n${passed.map(r => r.name).join(', ')}`;
    } else {
        console.error('TESTS FAILED');
        for (const f of failed) {
            console.error(`  - ${f.name}: ${f.error}`);
        }
        resultOverlay.textContent = 'TESTS FAILED';
        resultOverlay.style.background = 'rgba(200, 0, 0, 0.9)';
        resultOverlay.style.color = 'white';
        detailsOverlay.textContent = `Failed formats:\n${failed.map(f => `${f.name}: ${f.error}`).join('\n')}\n\nPassed: ${passed.map(r => r.name).join(', ')}`;
    }

    console.log('='.repeat(60));
}

// Create minimal app for the example framework
const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

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

// Run tests after a short delay to ensure everything is initialized
setTimeout(runTests, 100);

export { app };
