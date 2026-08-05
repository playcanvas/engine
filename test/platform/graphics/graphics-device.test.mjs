import { expect } from 'chai';

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
});
