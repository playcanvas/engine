import { expect } from 'chai';
import sinon from 'sinon';

import { WebgpuDebug } from '../../../../src/platform/graphics/webgpu/webgpu-debug.js';

// the queries a GPU process crash leaves pending reject, instead of reporting an error
const lostError = () => new DOMException('Instance dropped in popErrorScope', 'OperationError');

const createLostDevice = () => ({
    wgpu: {
        pushErrorScope() {},
        popErrorScope: () => Promise.reject(lostError())
    }
});

describe('WebgpuDebug', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('#end', function () {
        it('resolves without logging when the device is lost', async function () {
            const consoleError = sinon.stub(console, 'error');
            const device = createLostDevice();
            WebgpuDebug.validate(device);
            await WebgpuDebug.end(device, 'test');
            expect(consoleError.called).to.be.false;
        });
    });

    describe('#endShader', function () {
        it('resolves without logging when the device is lost', async function () {
            const consoleError = sinon.stub(console, 'error');
            const device = createLostDevice();
            const shaderModule = { getCompilationInfo: () => Promise.reject(lostError()) };
            WebgpuDebug.validate(device);
            await WebgpuDebug.endShader(device, shaderModule, 'source');
            expect(consoleError.called).to.be.false;
        });
    });
});
