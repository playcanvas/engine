import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { XrView } from '../../../src/framework/xr/xr-view.js';
import { PIXELFORMAT_R32F } from '../../../src/platform/graphics/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('XrView', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        restore();
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#destroy', function () {

        it('stops listening for the loss of the graphics device', function () {
            const onDeviceLost = spy(XrView.prototype, '_onDeviceLost');

            // a view with a depth sensing texture listens for the loss of the graphics device
            const manager = {
                app,
                views: {
                    supportedColor: false,
                    supportedDepth: true,
                    availableDepth: true,
                    depthGpuOptimized: false,
                    depthPixelFormat: PIXELFORMAT_R32F
                }
            };
            const view = new XrView(manager, { eye: 'none' }, 1);

            app.graphicsDevice.fire('devicelost');
            expect(onDeviceLost.callCount).to.equal(1);

            view.destroy();
            app.graphicsDevice.fire('devicelost');
            expect(onDeviceLost.callCount).to.equal(1);
        });

    });

});
