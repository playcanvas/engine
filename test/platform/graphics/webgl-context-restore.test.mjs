import { expect } from 'chai';
import sinon from 'sinon';

import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';
import { WebglRenderTarget } from '../../../src/platform/graphics/webgl/webgl-render-target.js';

describe('WebglGraphicsDevice context restoration', function () {
    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 64, height: 64 });
        device.backBuffer.destroy();

        // Exercise WebGL backbuffer management without requiring a browser context. Initializing
        // the default, single-sampled framebuffer should not allocate any GL attachments.
        device.gl = {};
        device.createRenderTargetImpl = () => new WebglRenderTarget();
        device.createBackbuffer = WebglGraphicsDevice.prototype.createBackbuffer;
        device.updateBackbuffer = WebglGraphicsDevice.prototype.updateBackbuffer;
        device.initializeExtensions = () => {};
        device.initializeCapabilities = () => {};
        device.setFramebuffer = sinon.spy();
        device._defaultFramebuffer = null;
        device._defaultFramebufferChanged = false;
        device.createBackbuffer(null);
        device.initRenderTarget(device.backBuffer);
        device.backBufferSize.set(64, 64);
    });

    afterEach(function () {
        device.backBuffer.destroy();
        device.destroy();
    });

    it('allows backbuffer rendering from devicerestored before frameStart', function () {
        device.loseContext();
        expect(device.backBuffer.impl.suppliedColorFramebuffer).to.be.undefined;

        let restored = false;
        device.once('devicerestored', () => {
            WebglGraphicsDevice.prototype.updateBegin.call(device);
            expect(device.backBuffer.impl.suppliedColorFramebuffer).to.equal(null);
            expect(device.setFramebuffer.calledOnceWithExactly(null)).to.be.true;
            restored = true;
        });

        WebglGraphicsDevice.prototype.restoreContext.call(device);
        expect(restored).to.be.true;
    });

    it('recreates the backbuffer at the current size after each loss', function () {
        for (const size of [128, 256]) {
            const oldBackbuffer = device.backBuffer;
            device.loseContext();
            device.canvas.width = size;
            device.canvas.height = size;

            WebglGraphicsDevice.prototype.restoreContext.call(device);

            expect(device.backBuffer).not.to.equal(oldBackbuffer);
            expect(device.targets.has(oldBackbuffer)).to.be.false;
            expect(device.backBufferSize.x).to.equal(size);
            expect(device.backBufferSize.y).to.equal(size);
            WebglGraphicsDevice.prototype.updateBegin.call(device);
        }
    });
});
