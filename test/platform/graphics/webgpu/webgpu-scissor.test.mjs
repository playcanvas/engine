import { expect } from 'chai';

import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

const setScissor = (x, y, w, h, flipY = true) => {
    const calls = [];
    const device = {
        renderTarget: { width: 256, height: 128, flipY },
        passEncoder: {
            setScissorRect: (...args) => calls.push(args)
        }
    };
    WebgpuGraphicsDevice.prototype.setScissor.call(device, x, y, w, h);
    expect(calls).to.have.lengthOf(1);
    expect([device.sx, device.sy, device.sw, device.sh]).to.deep.equal(calls[0]);
    return calls[0];
};

describe('WebgpuGraphicsDevice#setScissor', function () {

    it('passes a rectangle inside the render target through unchanged', function () {
        expect(setScissor(10, 20, 100, 50)).to.deep.equal([10, 20, 100, 50]);
    });

    it('clamps a rectangle with a negative origin', function () {
        expect(setScissor(-128, -64, 384, 256)).to.deep.equal([0, 0, 256, 128]);
    });

    it('clamps a rectangle extending past the right and bottom edges', function () {
        expect(setScissor(200, 100, 100, 100)).to.deep.equal([200, 100, 56, 28]);
    });

    it('produces an empty rectangle when fully outside the render target', function () {
        expect(setScissor(300, 0, 100, 100)).to.deep.equal([256, 0, 0, 100]);
        expect(setScissor(-200, 0, 100, 100)).to.deep.equal([0, 0, 0, 100]);
    });

    it('clamps after converting to a top-left origin', function () {
        // bottom-left origin y = -64 with height 128 covers rows [-64, 64), which is rows [64, 192) from the top
        expect(setScissor(0, -64, 256, 128, false)).to.deep.equal([0, 64, 256, 64]);
    });
});
