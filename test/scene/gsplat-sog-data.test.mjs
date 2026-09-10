import { expect } from 'chai';
import sinon from 'sinon';

import { NullGraphicsDevice } from '../../src/platform/graphics/null/null-graphics-device.js';
import { Texture } from '../../src/platform/graphics/texture.js';
import { WebglGraphicsDevice } from '../../src/platform/graphics/webgl/webgl-graphics-device.js';
import { GSplatSogData } from '../../src/scene/gsplat/gsplat-sog-data.js';
import { ShaderUtils } from '../../src/scene/shader-lib/shader-utils.js';

describe('GSplatSogData GPU preparation', function () {
    let device;
    let data;
    let generate;

    const lose = () => {
        device.loseContext();
        device.fire('devicelost');
    };

    const restore = () => {
        device.restoreContext();
        device.fire('devicerestored');
    };

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 1, height: 1 });
        data = new GSplatSogData();
        data.means_l = { device, destroy() {} };
        generate = sinon.stub(data, 'generateCenters').resolves();
    });

    afterEach(function () {
        data.destroy();
        device.destroy();
        sinon.restore();
    });

    it('waits for recovery when a download finishes while the device is lost', async function () {
        lose();
        const pending = data.prepareGpuData();
        expect(generate.called).to.be.false;
        restore();
        await pending;
        expect(generate.calledOnce).to.be.true;
        expect(device.hasEvent('devicerestored')).to.be.false;
        expect(device.hasEvent('devicelost')).to.be.false;
    });

    it('retries a rejected readback even if recovery finishes before it rejects', async function () {
        let rejectRead;
        generate.onFirstCall().returns(new Promise((resolve, reject) => {
            rejectRead = reject;
        }));
        const pending = data.prepareGpuData();
        lose();
        restore();
        rejectRead(new Error('webgl clientWaitSync sync failed'));
        await pending;
        expect(generate.calledTwice).to.be.true;
    });

    it('waits if native WebGL loss precedes the engine loss event', async function () {
        device.gl = { isContextLost: () => true };
        device.isContextLost = WebglGraphicsDevice.prototype.isContextLost;
        const pending = data.prepareGpuData();
        expect(device.contextLost).not.to.equal(true);
        expect(generate.called).to.be.false;
        lose();
        device.gl.isContextLost = () => false;
        restore();
        await pending;
        expect(generate.calledOnce).to.be.true;
    });

    it('retries a read that rejects before the native loss event arrives', async function () {
        device.gl = { isContextLost: () => false };
        device.isContextLost = WebglGraphicsDevice.prototype.isContextLost;
        generate.onFirstCall().callsFake(() => {
            device.gl.isContextLost = () => true;
            return Promise.reject(new Error('webgl clientWaitSync sync failed'));
        });
        const pending = data.prepareGpuData();
        await Promise.resolve();
        expect(generate.calledOnce).to.be.true;
        lose();
        device.gl.isContextLost = () => false;
        restore();
        await pending;
        expect(generate.calledTwice).to.be.true;
    });

    it('discards a resolved readback from a lost device and retries after recovery', async function () {
        let resolveRead;
        generate.onFirstCall().callsFake(async () => {
            await new Promise((resolve) => {
                resolveRead = resolve;
            });
            data._centers = new Float32Array([0, 0, 0]);
        });
        const centers = new Float32Array([1, 2, 3]);
        generate.onSecondCall().callsFake(() => {
            data._centers = centers;
        });
        const pending = data.prepareGpuData();
        lose();
        resolveRead();
        restore();
        await pending;
        expect(generate.calledTwice).to.be.true;
        expect(data.getCenters()).to.equal(centers);
    });

    it('propagates readback errors unrelated to device loss', async function () {
        const failure = new Error('readback failed');
        generate.rejects(failure);
        const result = await Promise.allSettled([data.prepareGpuData()]);
        expect(result[0]).to.deep.equal({ status: 'rejected', reason: failure });
        expect(generate.calledOnce).to.be.true;
        expect(device.hasEvent('devicelost')).to.be.false;
    });

    it('destroys the temporary centers texture when its readback fails', async function () {
        generate.restore();
        device.postInit();
        device.isNull = false;
        data.means_l = new Texture(device, { width: 1, height: 1 });
        data.means_u = data.means_l;
        data.numSplats = 1;
        data.meta = { means: { mins: [0, 0, 0], maxs: [1, 1, 1] } };
        sinon.stub(ShaderUtils, 'createShader').returns({ device });
        const failure = new Error('readback failed');
        sinon.stub(Texture.prototype, 'read').rejects(failure);
        const destroy = sinon.spy(Texture.prototype, 'destroy');

        const result = await Promise.allSettled([data.prepareGpuData()]);
        expect(result[0]).to.deep.equal({ status: 'rejected', reason: failure });
        expect(destroy.calledOnce).to.be.true;
        expect(destroy.firstCall.thisValue.name).to.equal('sogCentersTexture');
    });

    it('settles without starting GPU work if the device is destroyed during recovery', async function () {
        lose();
        const pending = data.prepareGpuData();
        device.destroy();
        await pending;
        expect(generate.called).to.be.false;
        expect(device.hasEvent('devicerestored')).to.be.false;
    });

    it('settles and removes recovery listeners when the data is destroyed', async function () {
        lose();
        const pending = data.prepareGpuData();
        data.destroy();
        await pending;
        expect(generate.called).to.be.false;
        expect(device.hasEvent('devicerestored')).to.be.false;
        expect(device.hasEvent('destroy')).to.be.false;
        restore();
        expect(generate.called).to.be.false;
    });

    it('cancels all concurrent recovery waits when the data is destroyed', async function () {
        lose();
        const first = data.prepareGpuData();
        const second = data.prepareGpuData();
        data.destroy();
        await Promise.all([first, second]);
        expect(generate.called).to.be.false;
        expect(device.hasEvent('devicerestored')).to.be.false;
        expect(device.hasEvent('destroy')).to.be.false;
    });
});
