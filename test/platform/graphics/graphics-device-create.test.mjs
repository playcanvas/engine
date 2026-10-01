import { expect } from 'chai';
import sinon from 'sinon';

import { DEVICETYPE_NULL, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU } from '../../../src/platform/graphics/constants.js';
import { createGraphicsDevice } from '../../../src/platform/graphics/graphics-device-create.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { WebgpuGraphicsDevice } from '../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

/**
 * Waits for a promise to settle. The devices tested here fail without waiting on anything but
 * microtasks, so a promise still pending after the timeout will never settle.
 *
 * @param {Promise} promise - The promise.
 * @returns {Promise<{ status: string, value?: any, reason?: any }>} The outcome, with a status of
 * 'fulfilled', 'rejected' or 'pending'.
 */
const settle = (promise) => {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: 'pending' }), 100);
    });
    const outcome = promise.then(
        value => ({ status: 'fulfilled', value }),
        reason => ({ status: 'rejected', reason })
    );
    return Promise.race([outcome, timeout]).finally(() => clearTimeout(timer));
};

describe('createGraphicsDevice', function () {

    let canvas;

    beforeEach(function () {
        // a canvas without a WebGL 2 context, as in a browser with WebGL disabled, which makes the
        // WebGL device constructor throw synchronously
        canvas = { width: 1, height: 1, getContext: sinon.stub().returns(null) };

        // silence the error logged for each device that fails to be created
        sinon.stub(console, 'log');
    });

    afterEach(function () {
        sinon.restore();
    });

    const expectFailure = (result, errorMessages) => {
        expect(result.status).to.equal('rejected');
        expect(result.reason).to.be.an.instanceof(AggregateError);
        expect(result.reason.message).to.equal('Failed to create a graphics device');
        expect(result.reason.errors.map(err => err.message)).to.deep.equal(errorMessages);
        expect(canvas.getContext.calledWith('webgl2')).to.be.true;
    };

    const expectNullDevice = (result) => {
        expect(result.status).to.equal('fulfilled');
        expect(result.value).to.be.an.instanceof(NullGraphicsDevice);
        expect(canvas.getContext.calledWith('webgl2')).to.be.true;
        result.value.destroy();
    };

    describe('when WebGL is attempted first', function () {

        it('rejects when WebGL fails', async function () {
            const result = await settle(createGraphicsDevice(canvas, {
                deviceTypes: [DEVICETYPE_WEBGL2]
            }));
            expectFailure(result, ['WebGL not supported']);
        });

        it('falls back to a requested null device when WebGL fails', async function () {
            const result = await settle(createGraphicsDevice(canvas, {
                deviceTypes: [DEVICETYPE_WEBGL2, DEVICETYPE_NULL]
            }));
            expectNullDevice(result);
        });

    });

    describe('when WebGPU is attempted first', function () {

        let hadWindow;
        let savedWindow;
        let initWebGpu;

        beforeEach(function () {
            // expose WebGPU, so that it is attempted before WebGL
            hadWindow = 'window' in globalThis;
            savedWindow = globalThis.window;
            globalThis.window = { navigator: { gpu: {} } };

            initWebGpu = sinon.stub(WebgpuGraphicsDevice.prototype, 'initWebGpu');
        });

        afterEach(function () {
            if (hadWindow) {
                globalThis.window = savedWindow;
            } else {
                delete globalThis.window;
            }
        });

        it('rejects when WebGPU rejects and WebGL fails', async function () {
            initWebGpu.rejects(new Error('No WebGPU adapter'));
            const result = await settle(createGraphicsDevice(canvas, {
                deviceTypes: [DEVICETYPE_WEBGPU]
            }));
            expectFailure(result, ['No WebGPU adapter', 'WebGL not supported']);
        });

        it('rejects when WebGPU resolves without a device and WebGL fails', async function () {
            initWebGpu.resolves(null);
            const result = await settle(createGraphicsDevice(canvas, {
                deviceTypes: [DEVICETYPE_WEBGPU]
            }));
            expectFailure(result, ['WebGL not supported']);
        });

        it('rejects when no WebGPU adapter is available and WebGL fails', async function () {
            initWebGpu.callThrough();
            globalThis.window.navigator.gpu.requestAdapter = sinon.stub().resolves(null);
            const result = await settle(createGraphicsDevice(canvas, {
                deviceTypes: [DEVICETYPE_WEBGPU]
            }));
            expectFailure(result, ['Unable to retrieve a WebGPU adapter', 'WebGL not supported']);
        });

        it('rejects when WebGPU is disabled on a PowerVR adapter and WebGL fails', async function () {
            initWebGpu.callThrough();
            globalThis.window.navigator.gpu.requestAdapter = sinon.stub().resolves({ info: { vendor: 'img-tec' } });
            const result = await settle(createGraphicsDevice(canvas, {
                deviceTypes: [DEVICETYPE_WEBGPU]
            }));
            expectFailure(result, [
                'WebGPU is disabled on Imagination PowerVR GPUs due to driver issues. See https://github.com/playcanvas/engine/issues/8874',
                'WebGL not supported'
            ]);
        });

        it('falls back to a requested null device when WebGPU and WebGL fail', async function () {
            initWebGpu.rejects(new Error('No WebGPU adapter'));
            const result = await settle(createGraphicsDevice(canvas, {
                deviceTypes: [DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL2, DEVICETYPE_NULL]
            }));
            expectNullDevice(result);
        });

    });

});
