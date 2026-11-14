import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8 } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { RenderPass } from '../../../src/platform/graphics/render-pass.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';

// The clear color of a render pass is in sRGB space. A color buffer of an sRGB format encodes the
// value it is cleared to, so the WebGL device clears it to the linear value, as WebGPU does. The
// device method runs against a fake context, as the real path needs a WebGL2 context.
describe('WebGL render pass clear', function () {

    let nullDevice;
    let device;

    // the colors passed to the clear of the device, and the attachments and values passed to
    // clearBufferfv
    let clears;
    let bufferClears;

    beforeEach(function () {
        nullDevice = new NullGraphicsDevice({ width: 4, height: 4 });
        clears = [];
        bufferClears = [];
        const noop = () => {};
        device = {
            gl: {
                COLOR: 0x1800,
                clearBufferfv: (buffer, index, values) => {
                    bufferClears.push([index, Array.from(values)]);
                },
                clearBufferiv: noop,
                clearBufferuiv: noop
            },
            insideRenderPass: false,
            updateBegin: noop,
            setViewport: noop,
            setScissor: noop,
            setBlendState: noop,
            pushMarker: noop,
            popMarker: noop,
            clear: options => clears.push(Array.from(options.color)),
            startRenderPass: WebglGraphicsDevice.prototype.startRenderPass
        };
    });

    afterEach(function () {
        nullDevice.destroy();
    });

    /**
     * Starts a render pass clearing a render target with the given color buffer formats to a
     * mid gray.
     *
     * @param {number[]} formats - The formats of the color buffers.
     */
    const startClearing = (formats) => {
        const colorBuffers = formats.map(format => new Texture(nullDevice, {
            width: 4,
            height: 4,
            format,
            mipmaps: false
        }));
        const renderTarget = new RenderTarget({ colorBuffers, depth: false });
        const renderPass = new RenderPass(nullDevice);
        renderPass.init(renderTarget);
        renderPass.setClearColor(new Color(0.2, 0.2, 0.2, 1));
        device.startRenderPass(renderPass);
    };

    const linear = 0.2 ** 2.2;

    it('clears an sRGB color buffer to the linear value of the clear color', function () {
        startClearing([PIXELFORMAT_SRGBA8]);

        expect(clears).to.have.lengthOf(1);
        const [r, g, b, a] = clears[0];
        for (const channel of [r, g, b]) {
            expect(channel).to.be.closeTo(linear, 1e-6);
        }
        expect(a).to.equal(1);
    });

    it('clears a color buffer of another format to the clear color as given', function () {
        startClearing([PIXELFORMAT_RGBA8]);

        expect(clears).to.have.lengthOf(1);
        for (const channel of clears[0].slice(0, 3)) {
            expect(channel).to.be.closeTo(0.2, 1e-6);
        }
    });

    it('clears each color buffer of a render target to the value matching its format', function () {
        startClearing([PIXELFORMAT_SRGBA8, PIXELFORMAT_RGBA8]);

        expect(bufferClears).to.have.lengthOf(2);
        const [[index0, srgb], [index1, other]] = bufferClears;
        expect(index0).to.equal(0);
        expect(srgb[0]).to.be.closeTo(linear, 1e-6);
        expect(index1).to.equal(1);
        expect(other[0]).to.be.closeTo(0.2, 1e-6);
    });
});
