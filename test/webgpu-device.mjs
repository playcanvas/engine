// Runs the unit tests on a real WebGPU implementation: Google Dawn, through the `webgpu` package.
// Loaded by `npm run test:webgpu` (mocha --require); `npm test` does not load it and keeps using the
// null device. One Dawn device is created up front and shared by every graphics device the tests
// create, and any error WebGPU reports during a test fails that test.
//
// Dawn's `null` backend is used by default: it performs the full API validation and compiles the
// WGSL shaders, but executes no GPU work, so it runs anywhere, including CI machines without a GPU.
// Set PC_WEBGPU_BACKEND to `metal`, `vulkan` or `d3d12` to run on the GPU instead.
import { create, globals } from 'webgpu';

import { setWebgpuTestDevice } from './device.mjs';
import { HeadlessCanvasContext, ImageBitmap, createImageBitmap, installImageUploadShim } from './webgpu-shims.mjs';

const backend = process.env.PC_WEBGPU_BACKEND ?? 'null';

// the GPU* classes and constants the engine reads as globals, and the image decoding a browser has
Object.assign(globalThis, globals);
globalThis.ImageBitmap ??= ImageBitmap;
globalThis.createImageBitmap ??= createImageBitmap;

const gpu = create([`backend=${backend}`]);
const adapter = await gpu.requestAdapter();
if (!adapter) {
    throw new Error(`WebGPU unit tests: no adapter for the '${backend}' backend`);
}

// request everything the adapter offers, as the engine does, so the capabilities match a browser
const requiredLimits = {};
for (const name in adapter.limits) {
    if (name !== 'minSubgroupSize' && name !== 'maxSubgroupSize') {
        requiredLimits[name] = adapter.limits[name];
    }
}
const device = await adapter.requestDevice({
    requiredFeatures: Array.from(adapter.features),
    requiredLimits,
    defaultQueue: { label: 'Unit Tests' }
});
installImageUploadShim(device);

setWebgpuTestDevice({
    gpu,
    adapter,
    device,
    createCanvasContext: canvas => new HeadlessCanvasContext(canvas)
});

console.log(`Unit tests running on WebGPU (Dawn, ${backend} backend)`);

// Errors WebGPU reports arrive on two channels: the engine's debug error scopes print them with
// console.error, and errors outside a scope fire uncapturederror on the device. Both are collected
// per test and fail it.
const errors = [];
const consoleError = console.error;
device.addEventListener('uncapturederror', (event) => {
    errors.push(`uncaptured: ${event.error.message.split('\n')[0]}`);
});

export const mochaHooks = {
    beforeEach() {
        errors.length = 0;
        console.error = (...args) => {
            const message = args.map(String).join(' ');
            if (message.startsWith('WebGPU ') && !message.startsWith('WebGPU uncaptured')) {
                errors.push(message.split('\n')[0]);
            } else {
                consoleError(...args);
            }
        };
    },

    async afterEach() {
        // error scopes and uncaptured errors resolve asynchronously, so let the device catch up
        await device.queue.onSubmittedWorkDone();
        await new Promise((resolve) => {
            setImmediate(resolve);
        });
        console.error = consoleError;

        if (errors.length) {
            const unique = [...new Set(errors)];
            errors.length = 0;
            throw new Error(`WebGPU reported ${unique.length} error(s) during "${this.currentTest.fullTitle()}":\n  ${unique.join('\n  ')}`);
        }
    }
};

export const mochaGlobalTeardown = () => {
    device.destroy();
};
