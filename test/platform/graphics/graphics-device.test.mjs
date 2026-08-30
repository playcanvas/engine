import { expect } from 'chai';

import {
    PIXELFORMAT_111110F, PIXELFORMAT_R16F, PIXELFORMAT_R32F, PIXELFORMAT_RG16F, PIXELFORMAT_RG32F,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F
} from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('GraphicsDevice', function () {

    describe('#constructor', function () {

        it('does not throw with a mock canvas lacking getBoundingClientRect', function () {
            const device = new NullGraphicsDevice({ id: 'mock' });
            expect(device.clientRect.width).to.equal(0);
            expect(device.clientRect.height).to.equal(0);
            device.destroy();
        });

        it('initializes clientRect from mock canvas width and height', function () {
            const device = new NullGraphicsDevice({ width: 300, height: 150 });
            expect(device.clientRect.width).to.equal(300);
            expect(device.clientRect.height).to.equal(150);
            device.destroy();
        });

        describe('with a DOM canvas', function () {

            beforeEach(function () {
                jsdomSetup();
            });

            afterEach(function () {
                jsdomTeardown();
            });

            it('initializes clientRect using getBoundingClientRect', function () {
                const canvas = document.createElement('canvas');
                canvas.getBoundingClientRect = () => ({ width: 640, height: 480 });
                const device = new NullGraphicsDevice(canvas);
                expect(device.clientRect.width).to.equal(640);
                expect(device.clientRect.height).to.equal(480);
                device.destroy();
            });
        });
    });

    describe('#getRenderableHdrFormat', function () {

        let device;

        beforeEach(function () {
            // the null device is renderable in both float precisions, but supports neither the
            // filtering nor the blending of the 32bit float formats
            device = new NullGraphicsDevice({ id: 'mock' });
        });

        afterEach(function () {
            device.destroy();
        });

        it('returns the first supported format from the supplied list', function () {
            expect(device.getRenderableHdrFormat([PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F], false)).to.equal(PIXELFORMAT_RGBA32F);
            expect(device.getRenderableHdrFormat([PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F], false)).to.equal(PIXELFORMAT_RGBA16F);
            expect(device.getRenderableHdrFormat()).to.equal(PIXELFORMAT_RGBA16F);
        });

        it('supports every channel count of both float precisions', function () {
            const formats = [
                PIXELFORMAT_R16F, PIXELFORMAT_RG16F, PIXELFORMAT_RGBA16F,
                PIXELFORMAT_R32F, PIXELFORMAT_RG32F, PIXELFORMAT_RGBA32F
            ];
            formats.forEach((format) => {
                expect(device.getRenderableHdrFormat([format], false)).to.equal(format);
            });
        });

        it('skips a format it does not handle instead of failing', function () {
            // three channel float formats are not renderable on either backend
            expect(device.getRenderableHdrFormat([PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F], false)).to.be.undefined;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_RGB32F, PIXELFORMAT_R16F], false)).to.equal(PIXELFORMAT_R16F);
        });

        it('falls back to a half float format when 32bit float blending is not supported', function () {
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F, PIXELFORMAT_R16F], false, 1, true)).to.equal(PIXELFORMAT_R16F);
        });

        it('returns a 32bit float format when its blending is supported', function () {
            device.textureFloatBlendable = true;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F, PIXELFORMAT_R16F], false, 1, true)).to.equal(PIXELFORMAT_R32F);
        });

        it('tests filtering and blending independently', function () {

            // blendable but not filterable
            device.textureFloatBlendable = true;
            device.textureFloatFilterable = false;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F], true, 1, true)).to.be.undefined;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F], false, 1, true)).to.equal(PIXELFORMAT_R32F);

            // filterable but not blendable
            device.textureFloatBlendable = false;
            device.textureFloatFilterable = true;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F], true, 1, true)).to.be.undefined;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F], true, 1, false)).to.equal(PIXELFORMAT_R32F);
        });

        it('does not require a blending capability for the half float formats', function () {
            expect(device.textureFloatBlendable).to.be.false;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R16F], false, 1, true)).to.equal(PIXELFORMAT_R16F);
            expect(device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F], false, 1, true)).to.equal(PIXELFORMAT_RGBA16F);
        });

        it('skips the multi-sampled 32bit float formats on WebGPU', function () {
            device.isWebGPU = true;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F, PIXELFORMAT_R16F], false, 4)).to.equal(PIXELFORMAT_R16F);
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F], false, 4)).to.be.undefined;
        });

        it('returns undefined when no format in the list is renderable', function () {
            device.textureFloatRenderable = false;
            device.textureHalfFloatRenderable = false;
            expect(device.getRenderableHdrFormat([PIXELFORMAT_R32F, PIXELFORMAT_R16F], false)).to.be.undefined;
        });
    });
});
