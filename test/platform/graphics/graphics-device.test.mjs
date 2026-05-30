import { expect } from 'chai';

import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { WebgpuGraphicsDevice } from '../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('GraphicsDevice', function () {

    describe('#isReverseZ', function () {

        beforeEach(function () {
            jsdomSetup();
        });

        afterEach(function () {
            jsdomTeardown();
        });

        it('defaults to false on NullGraphicsDevice', function () {
            const canvas = document.createElement('canvas');
            const device = new NullGraphicsDevice(canvas);
            expect(device.isReverseZ).to.equal(false);
            device.destroy();
        });

        it('defaults to false on WebgpuGraphicsDevice when option omitted', function () {
            const canvas = document.createElement('canvas');
            const device = new WebgpuGraphicsDevice(canvas, {});
            expect(device.isReverseZ).to.equal(false);
        });

        it('is true on WebgpuGraphicsDevice when reverseZ option is true', function () {
            const canvas = document.createElement('canvas');
            const device = new WebgpuGraphicsDevice(canvas, { reverseZ: true });
            expect(device.isReverseZ).to.equal(true);
        });

        it('is false on WebgpuGraphicsDevice when reverseZ option is false', function () {
            const canvas = document.createElement('canvas');
            const device = new WebgpuGraphicsDevice(canvas, { reverseZ: false });
            expect(device.isReverseZ).to.equal(false);
        });

    });

});
