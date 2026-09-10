import { expect } from 'chai';
import sinon from 'sinon';

import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';
import { WebglTexture } from '../../../src/platform/graphics/webgl/webgl-texture.js';

describe('WebglTexture upload during context loss', function () {
    it('skips uploads after the device has been destroyed', function () {
        const device = {
            contextLost: false,
            gl: null,
            isContextLost: WebglGraphicsDevice.prototype.isContextLost,
            setTexture: sinon.spy()
        };
        const texture = { _needsUpload: true, _needsMipmapsUpload: true };

        expect(device.isContextLost()).to.be.true;
        WebglTexture.prototype.uploadImmediate(device, texture);
        expect(device.setTexture.called).to.be.false;
        expect(texture._needsUpload).to.be.true;
        expect(texture._needsMipmapsUpload).to.be.true;
    });

    it('keeps uploads pending until both native and engine recovery have completed', function () {
        const device = {
            contextLost: false,
            gl: { isContextLost: () => true },
            isContextLost: WebglGraphicsDevice.prototype.isContextLost,
            setTexture: sinon.spy()
        };
        const texture = { _needsUpload: true, _needsMipmapsUpload: true };

        // The native context may be lost before the engine receives its loss event.
        WebglTexture.prototype.uploadImmediate(device, texture);
        expect(device.setTexture.called).to.be.false;
        expect(texture._needsUpload).to.be.true;
        expect(texture._needsMipmapsUpload).to.be.true;

        device.contextLost = true;
        device.gl.isContextLost = () => false;
        WebglTexture.prototype.uploadImmediate(device, texture);
        expect(device.setTexture.called).to.be.false;

        device.contextLost = false;
        WebglTexture.prototype.uploadImmediate(device, texture);
        expect(device.setTexture.calledOnceWithExactly(texture, 0)).to.be.true;
        expect(texture._needsUpload).to.be.false;
        expect(texture._needsMipmapsUpload).to.be.false;
    });
});
