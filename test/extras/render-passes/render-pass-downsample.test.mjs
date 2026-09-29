import { expect } from 'chai';

import { RenderPassDownsample } from '../../../src/extras/render-passes/render-pass-downsample.js';
import { PIXELFORMAT_RGBA16F } from '../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { createGraphicsDevice, setupShaderLibrary } from '../../device.mjs';

describe('RenderPassDownsample', function () {

    /** @type {import('../../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    /** @type {RenderPassDownsample} */
    let pass;

    /** @type {RenderTarget} */
    let renderTarget;

    const createTexture = (name, width, height) => new Texture(device, {
        name,
        width,
        height,
        format: PIXELFORMAT_RGBA16F,
        mipmaps: false
    });

    // replaces the pass' quad with one recording what its draw samples
    const recordDraw = () => {
        const draw = {};
        pass.quadRender = {
            render: () => {
                draw.texture = device.scope.resolve('sourceTexture').value;
                draw.invResolution = Array.from(device.scope.resolve('sourceInvResolution').value);
            },
            destroy: () => {}
        };
        return draw;
    };

    beforeEach(function () {
        device = createGraphicsDevice({ width: 128, height: 128 });

        // the pass compiles a shader
        setupShaderLibrary(device);

        renderTarget = new RenderTarget({
            colorBuffer: createTexture('Downsampled', 1, 1),
            depth: false
        });
    });

    afterEach(function () {
        pass?.destroy();
        pass = null;
        renderTarget?.destroyTextureBuffers();
        renderTarget?.destroy();
        renderTarget = null;
        device?.destroy();
        device = null;
    });

    it('samples the texture it was created with', function () {
        const source = createTexture('Source', 64, 32);
        pass = new RenderPassDownsample(device, source);
        pass.init(renderTarget, { resizeSource: source, scaleX: 0.5, scaleY: 0.5 });
        const draw = recordDraw();

        pass.execute();

        expect(draw.texture).to.equal(source);
        expect(draw.invResolution).to.deep.equal([1 / 64, 1 / 32]);
    });

    it('samples the texture set by setSourceTexture', function () {
        const source = createTexture('Source', 64, 32);
        const other = createTexture('Other', 128, 64);
        pass = new RenderPassDownsample(device, source);
        pass.init(renderTarget, { resizeSource: source, scaleX: 0.5, scaleY: 0.5 });
        const draw = recordDraw();

        pass.setSourceTexture(other);
        pass.execute();

        expect(draw.texture).to.equal(other);
        expect(draw.invResolution).to.deep.equal([1 / 128, 1 / 64]);
    });

    it('sizes its render target from the texture set by setSourceTexture', function () {
        const source = createTexture('Source', 64, 32);
        pass = new RenderPassDownsample(device, source);
        pass.init(renderTarget, { resizeSource: source, scaleX: 0.5, scaleY: 0.5 });

        pass.setSourceTexture(createTexture('Other', 128, 64));
        pass.frameUpdate();

        expect(renderTarget.width).to.equal(64);
        expect(renderTarget.height).to.equal(32);
    });
});
